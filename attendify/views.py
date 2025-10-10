import json
import secrets
import qrcode
import logging
from io import BytesIO
from datetime import datetime, timedelta
from functools import wraps
from math import radians, sin, cos, sqrt, atan2

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, logout, authenticate, update_session_auth_hash
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib import messages
from django.http import Http404, JsonResponse, HttpResponse, HttpResponseRedirect
from django.db.models import Count, Q, Avg, Sum, Case, When, IntegerField, F, FloatField, ExpressionWrapper
from django.db import transaction
from django.utils import timezone
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from django.urls import reverse, reverse_lazy
from django.core.files.base import ContentFile
from django.core.exceptions import PermissionDenied, ValidationError
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils.decorators import method_decorator
from django.conf import settings
from django.core.cache import cache
from django.views.decorators.cache import cache_page

from .models import *
from .forms import (
    UserCreationForm, UserUpdateForm, CustomPasswordChangeForm,
    StudentProfileForm, LecturerProfileForm, AdminProfileForm,
    DepartmentForm, CourseForm, SemesterForm, UnitForm,
    EnrollmentForm, SemesterUnitForm, ClassScheduleForm,
    AttendanceReportForm, QRScanForm, ManualAttendanceForm,
    DateRangeFilterForm, StudentSearchForm, AttendanceFilterForm
)

logger = logging.getLogger(__name__)

# ---------------------------
# Constants and Configuration
# ---------------------------

EARTH_RADIUS_METERS = 6371000
QR_CODE_EXPIRY_MINUTES = 5
SYSTEM_STATS_CACHE_TIMEOUT = 60
SCAN_RATE_LIMIT_SECONDS = 2
LOCATION_RADIUS_METERS = 100  # 100 meters radius for location validation

# ---------------------------
# Utility / Role check helpers
# ---------------------------

def is_admin(user):
    """Check if user is admin with consistent attribute access"""
    if not getattr(user, "is_authenticated", False):
        return False
    
    # Prefer boolean flags, fallback to user_type
    if getattr(user, "is_admin", False):
        return True
    if hasattr(user, "user_type") and getattr(user, "user_type") == "ADMIN":
        return True
    return False

def is_lecturer(user):
    """Check if user is lecturer with consistent attribute access"""
    if not getattr(user, "is_authenticated", False):
        return False
    
    if getattr(user, "is_lecturer", False):
        return True
    if hasattr(user, "user_type") and getattr(user, "user_type") == "LECTURER":
        return True
    return False

def is_student(user):
    """Check if user is student with consistent attribute access"""
    if not getattr(user, "is_authenticated", False):
        return False
    
    if getattr(user, "is_student", False):
        return True
    if hasattr(user, "user_type") and getattr(user, "user_type") == "STUDENT":
        return True
    return False

def get_user_profile(user):
    """Safely get user profile with consistent attribute access"""
    if is_student(user) and hasattr(user, 'student_profile'):
        return user.student_profile
    elif is_lecturer(user) and hasattr(user, 'lecturer_profile'):
        return user.lecturer_profile
    elif is_admin(user) and hasattr(user, 'admin_profile'):
        return user.admin_profile
    return None

def admin_required(view_func):
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if not is_admin(request.user):
            return redirect('login')
        return view_func(request, *args, **kwargs)
    return login_required(_wrapped_view)

def lecturer_required(view_func):
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if not is_lecturer(request.user):
            return redirect('login')
        return view_func(request, *args, **kwargs)
    return login_required(_wrapped_view)

def student_required(view_func):
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if not is_student(request.user):
            return redirect('login')
        return view_func(request, *args, **kwargs)
    return login_required(_wrapped_view)

def log_system_action(user, action_type, description, metadata=None, ip_address=None, user_agent=None):
    """Utility function to log system actions"""
    try:
        SystemLog.objects.create(
            user=user,
            action_type=action_type,
            description=description,
            metadata=metadata or {},
            ip_address=ip_address,
            user_agent=user_agent
        )
    except Exception as e:
        logger.exception("Failed to write system log: %s", str(e))

# ---------------------------
# QR System Core Functions - UPDATED
# ---------------------------

def validate_location(user_lat, user_lng, class_lat, class_lng, radius_meters=LOCATION_RADIUS_METERS):
    """
    Validate if user location is within allowed radius of class location using Haversine formula.
    Returns True if location is valid, False otherwise.
    """
    try:
        # Convert degrees to radians
        lat1 = radians(float(user_lat))
        lon1 = radians(float(user_lng))
        lat2 = radians(float(class_lat))
        lon2 = radians(float(class_lng))

        # Haversine formula
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
        c = 2 * atan2(sqrt(a), sqrt(1 - a))
        distance = EARTH_RADIUS_METERS * c  # Earth radius in meters

        logger.info(f"Location validation - Distance: {distance:.2f}m, Allowed: {radius_meters}m")
        return distance <= float(radius_meters)
    except (TypeError, ValueError, ZeroDivisionError) as e:
        logger.error("Location validation error: %s", str(e))
        return False

def get_class_status(class_schedule):
    """
    Comprehensive class status determination - UPDATED
    Returns: 'UPCOMING', 'ONGOING', 'ENDED'
    """
    now = timezone.now()
    
    # Combine the actual schedule date with times
    class_date = class_schedule.schedule_date
    class_start = timezone.make_aware(datetime.combine(class_date, class_schedule.start_time))
    class_end = timezone.make_aware(datetime.combine(class_date, class_schedule.end_time))
    
    print(f"DEBUG: Class {class_schedule.id}")
    print(f"  Now: {now}")
    print(f"  Start: {class_start}")
    print(f"  End: {class_end}")
    print(f"  Time to start: {class_start - now}")
    print(f"  Time to end: {class_end - now}")
    
    if now < class_start:
        status = 'UPCOMING'
    elif class_start <= now <= class_end:
        status = 'ONGOING'
    else:
        status = 'ENDED'
    
    print(f"  Calculated status: {status}")
    return status

def is_class_ongoing(class_schedule):
    """Check if a class is currently ongoing (fixed version)"""
    return get_class_status(class_schedule) == 'ONGOING'

def can_generate_qr(class_schedule):
    """Check if QR code can be generated for this class - UPDATED"""
    status = get_class_status(class_schedule)
    print(f"DEBUG: Class {class_schedule.id} - Status: {status}, Can Generate: {status == 'ONGOING'}")
    return status == 'ONGOING'

def validate_qr_token(qr_token, class_schedule):
    """
    Validate QR token for a class schedule.
    Returns (is_valid, qr_code_object, error_message)
    """
    try:
        # Find active QR code with this token
        qr_code = QRCode.objects.filter(
            token=qr_token,
            class_schedule=class_schedule,
            is_active=True
        ).first()

        if not qr_code:
            return False, None, "Invalid QR code"

        # Check if QR code has expired
        if qr_code.expires_at < timezone.now():
            qr_code.is_active = False
            qr_code.save()
            return False, None, "QR code has expired"

        # Check if class is ongoing
        if not is_class_ongoing(class_schedule):
            return False, None, "Class is not currently ongoing"

        return True, qr_code, "Valid QR code"

    except Exception as e:
        logger.error("QR token validation error: %s", str(e))
        return False, None, "Error validating QR code"

# ---------------------------
# Dashboard redirect
# ---------------------------

@login_required
def dashboard_redirect(request):
    """Redirect to appropriate dashboard based on user type/flags."""
    user = request.user
    
    # Use consistent role checking
    if is_admin(user):
        return redirect('/admin/')
    if is_lecturer(user):
        return redirect('lecturer_dashboard')
    if is_student(user):
        return redirect('student_dashboard')

    # Last-resort fallback
    logger.warning("dashboard_redirect: unknown user type for user=%s", getattr(user, "username", "<anonymous>"))
    messages.error(request, "Unable to determine user role. Please contact administrator.")
    return redirect('login')

# ---------------------------
# System APIs
# ---------------------------

@cache_page(SYSTEM_STATS_CACHE_TIMEOUT)
def api_system_stats(request):
    """API endpoint for real-time system statistics"""
    today = timezone.now().date()
    
    # Create cache key based on date for automatic invalidation
    cache_key = f"system_stats_{today}"
    cached_stats = cache.get(cache_key)
    
    if cached_stats:
        return JsonResponse(cached_stats)

    try:
        stats = {
            'active_users': User.objects.filter(
                last_login__date=today,
                is_active=True
            ).count(),
            'today_classes': ClassSchedule.objects.filter(
                schedule_date=today,
                is_active=True
            ).count(),
            'today_attendance': Attendance.objects.filter(
                class_schedule__schedule_date=today
            ).count(),
            'system_uptime': '99.9%',
            'timestamp': timezone.now().isoformat()
        }
        
        # Cache the results
        cache.set(cache_key, stats, SYSTEM_STATS_CACHE_TIMEOUT)
        
        return JsonResponse(stats)
    except Exception as e:
        logger.error("Error generating system stats: %s", str(e))
        return JsonResponse({'error': 'Unable to fetch system statistics'}, status=500)

# ---------------------------
# Authentication views
# ---------------------------

def login_view(request):
    """
    Login view that redirects users to the correct dashboard depending on their role.
    Uses consistent role checking.
    """
    # If user is already authenticated, send them to their dashboard
    if request.user.is_authenticated:
        logger.debug("User already authenticated: %s", request.user.username)
        return dashboard_redirect(request)

    # Gather stats for login page
    today = timezone.now().date()
    try:
        context = {
            'total_students': StudentProfile.objects.count(),
            'total_lecturers': LecturerProfile.objects.count(),
            'total_classes': ClassSchedule.objects.count(),
            'total_attendance_records': Attendance.objects.count(),
            'active_users': User.objects.filter(last_login__date=today, is_active=True).count(),
            'today_classes': ClassSchedule.objects.filter(schedule_date=today, is_active=True).count(),
            'demo_enabled': getattr(settings, 'DEMO_MODE', False),
        }
    except Exception as e:
        logger.error("Error loading login page stats: %s", str(e))
        context = {
            'total_students': 0,
            'total_lecturers': 0,
            'total_classes': 0,
            'total_attendance_records': 0,
            'active_users': 0,
            'today_classes': 0,
            'demo_enabled': getattr(settings, 'DEMO_MODE', False),
        }

    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        logger.info("Login attempt for username=%s", username)

        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            logger.info("Login successful for username=%s", user.username)

            # Log the action
            log_system_action(
                user,
                SystemLog.ActionType.LOGIN,
                f"User {username} logged in",
                {'login_time': timezone.now().isoformat()},
                request.META.get('REMOTE_ADDR'),
                request.META.get('HTTP_USER_AGENT')
            )

            return dashboard_redirect(request)
        else:
            logger.warning("Login failed for username=%s", username)
            messages.error(request, 'Invalid username or password.')

    return render(request, 'index.html', context)

@login_required
def logout_view(request):
    """Logout view with proper error handling"""
    try:
        log_system_action(
            request.user, 
            SystemLog.ActionType.LOGOUT, 
            f"User {request.user.username} logged out"
        )
    except Exception as e:
        logger.error("Failed to log logout action for user=%s: %s", 
                    getattr(request.user, 'username', '<unknown>'), str(e))
    
    logout(request)
    messages.info(request, 'You have been logged out successfully.')
    return redirect('login')

@login_required
def change_password(request):
    """Password change view with proper transaction handling"""
    if request.method == 'POST':
        form = CustomPasswordChangeForm(request.user, request.POST)
        if form.is_valid():
            try:
                with transaction.atomic():
                    user = form.save()
                    update_session_auth_hash(request, user)
                    log_system_action(
                        request.user, 
                        SystemLog.ActionType.UPDATE, 
                        "Password changed successfully"
                    )
                messages.success(request, 'Your password was successfully updated!')
                return redirect('profile')
            except Exception as e:
                logger.error("Error changing password for user=%s: %s", request.user.username, str(e))
                messages.error(request, 'An error occurred while updating your password.')
        else:
            messages.error(request, 'Please correct the error below.')
    else:
        form = CustomPasswordChangeForm(request.user)

    return render(request, 'auth/change_password.html', {'form': form})

# ---------------------------
# Profile Management
# ---------------------------

@login_required
def profile_view(request):
    """Profile view with consistent role checking and error handling"""
    user = request.user
    profile = get_user_profile(user)
    
    if not profile:
        logger.error("profile_view: no profile found for user=%s", user.username)
        messages.error(request, "User profile not found. Please contact administrator.")
        return render(request, 'profile/missing_profile.html', {'user': user})
    
    context = {'user': user, 'profile': profile}
    
    if is_student(user):
        return render(request, 'student/dashboard.html', context)
    elif is_lecturer(user):
        return render(request, 'lecturer/dashboard.html', context)
    elif is_admin(user):
        return redirect('/admin/')
    
    logger.error("profile_view: unknown user type for user=%s", user.username)
    raise PermissionDenied("User profile missing or invalid user type")

@login_required
def profile_edit(request):
    """Profile edit view with transaction safety"""
    user = request.user
    profile = get_user_profile(user)
    
    if not profile:
        messages.error(request, "Profile not found. Contact administrator.")
        return redirect('profile')

    if request.method == 'POST':
        user_form = UserUpdateForm(request.POST, request.FILES, instance=user)
        
        # Determine profile form based on user type
        profile_form_class = None
        if is_student(user):
            profile_form_class = StudentProfileForm
        elif is_lecturer(user):
            profile_form_class = LecturerProfileForm
        elif is_admin(user):
            profile_form_class = AdminProfileForm
            
        profile_form = profile_form_class(request.POST, request.FILES, instance=profile) if profile_form_class else None

        if user_form.is_valid() and (profile_form is None or profile_form.is_valid()):
            try:
                with transaction.atomic():
                    user_form.save()
                    if profile_form:
                        profile_form.save()
                    log_system_action(user, SystemLog.ActionType.UPDATE, "Profile updated")
                messages.success(request, 'Profile updated successfully!')
                return redirect('profile')
            except Exception as e:
                logger.error("Error updating profile for user=%s: %s", user.username, str(e))
                messages.error(request, 'An error occurred while updating your profile.')
        else:
            messages.error(request, 'Please correct the errors below.')
    else:
        user_form = UserUpdateForm(instance=user)
        if is_student(user):
            profile_form = StudentProfileForm(instance=profile)
        elif is_lecturer(user):
            profile_form = LecturerProfileForm(instance=profile)
        elif is_admin(user):
            profile_form = AdminProfileForm(instance=profile)
        else:
            profile_form = None

    context = {
        'user_form': user_form,
        'profile_form': profile_form,
        'user_type': getattr(user, 'user_type', None)
    }

    if is_student(user):
        return render(request, 'student/dashboard.html', context)
    elif is_lecturer(user):
        return render(request, 'lecturer/dashboard.html', context)
    elif is_admin(user):
        return redirect('/admin/')

    return render(request, 'profile/edit.html', context)

# ---------------------------
# Admin helpers (redirects to Django admin)
# ---------------------------

@admin_required
def admin_dashboard(request):
    return redirect('/admin/')

@admin_required
def manage_departments(request):
    return redirect('/admin/attendify/department/')

@admin_required
def create_department(request):
    return redirect('/admin/attendify/department/add/')

@admin_required
def manage_courses(request):
    return redirect('/admin/attendify/course/')

@admin_required
def create_course(request):
    return redirect('/admin/attendify/course/add/')

@admin_required
def manage_semesters(request):
    return redirect('/admin/attendify/semester/')

@admin_required
def create_semester(request):
    return redirect('/admin/attendify/semester/add/')

@admin_required
def manage_units(request):
    return redirect('/admin/attendify/unit/')

@admin_required
def create_unit(request):
    return redirect('/admin/attendify/unit/add/')

@admin_required
def manage_lecturers(request):
    return redirect('/admin/attendify/lecturerprofile/')

@admin_required
def create_lecturer(request):
    return redirect('/admin/attendify/lecturerprofile/add/')

@admin_required
def manage_students(request):
    return redirect('/admin/attendify/studentprofile/')

@admin_required
def create_student(request):
    return redirect('/admin/attendify/studentprofile/add/')

@admin_required
def enroll_student(request):
    return redirect('/admin/attendify/enrollment/add/')

@admin_required
def assign_unit_lecturer(request):
    return redirect('/admin/attendify/semesterunit/')

@admin_required
def system_logs(request):
    return redirect('/admin/attendify/systemlog/')

# ---------------------------
# Lecturer Views - UPDATED WITH FIXED STATUS
# ---------------------------

@lecturer_required
def lecturer_dashboard(request):
    """Lecturer dashboard with proper error handling"""
    try:
        lecturer = request.user.lecturer_profile
    except LecturerProfile.DoesNotExist:
        logger.error("lecturer_dashboard: missing lecturer profile for user=%s", request.user.username)
        messages.error(request, "Lecturer profile not found. Contact administrator.")
        return redirect('profile')
    
    today = timezone.now().date()

    try:
        # Lecturer's statistics
        teaching_units = SemesterUnit.objects.filter(lecturer=lecturer).count()
        total_students = StudentUnitEnrollment.objects.filter(
            semester_unit__lecturer=lecturer
        ).values('student').distinct().count()

        # Today's classes with CORRECT status
        todays_classes = ClassSchedule.objects.filter(
            lecturer=lecturer,
            schedule_date=today,
            is_active=True
        ).select_related('semester_unit__unit')

        # Mark status for classes using new function
        for class_obj in todays_classes:
            class_obj.status = get_class_status(class_obj)
            class_obj.is_ongoing = class_obj.status == 'ONGOING'
            class_obj.can_generate_qr = can_generate_qr(class_obj)

        # Upcoming classes (next 7 days)
        upcoming_start = today + timedelta(days=1)
        upcoming_end = today + timedelta(days=7)
        upcoming_classes = ClassSchedule.objects.filter(
            lecturer=lecturer,
            schedule_date__range=[upcoming_start, upcoming_end],
            is_active=True
        ).order_by('schedule_date', 'start_time').select_related('semester_unit__unit')

        # Preload forms for profile modal
        user_form = UserUpdateForm(instance=request.user)
        profile_form = LecturerProfileForm(instance=lecturer)

        context = {
            'lecturer': lecturer,
            'teaching_units': teaching_units,
            'total_students': total_students,
            'todays_classes': todays_classes,
            'upcoming_classes': upcoming_classes,
            'user_form': user_form,
            'profile_form': profile_form,
        }
        return render(request, 'lecturer/dashboard.html', context)
    except Exception as e:
        logger.error("Error loading lecturer dashboard for user=%s: %s", request.user.username, str(e))
        messages.error(request, "Error loading dashboard data.")
        return render(request, 'lecturer/dashboard.html', {'lecturer': lecturer})

@lecturer_required
def lecturer_portal(request):
    """Combined portal for classes, units, and management with complete data"""
    try:
        lecturer = request.user.lecturer_profile
        print(f"DEBUG: Lecturer found - ID: {lecturer.id}, Name: {lecturer.user.get_full_name()}")
    except LecturerProfile.DoesNotExist:
        messages.error(request, "Lecturer profile not found.")
        return redirect('profile')
        
    active_tab = request.GET.get('tab', 'classes')
    today = timezone.now().date()
    now = timezone.now()

    try:
        # ==================== UNITS DATA ====================
        print(f"DEBUG: Fetching units for lecturer {lecturer.id}")
        
        # Get all teaching units with complete data
        units = SemesterUnit.objects.filter(lecturer=lecturer).select_related(
            'unit', 'semester', 'unit__department'
        ).prefetch_related('enrolled_students')
        
        print(f"DEBUG: Raw units count from database: {units.count()}")
        
        # Calculate comprehensive statistics for each unit
        units_list = []
        for unit in units:
            print(f"DEBUG: Processing unit: {unit.unit.code} - {unit.unit.name}")
            
            # Student enrollment count
            enrolled_students_count = StudentUnitEnrollment.objects.filter(
                semester_unit=unit, 
                is_active=True
            ).count()
            
            # Completed classes (past classes)
            completed_classes = ClassSchedule.objects.filter(
                semester_unit=unit,
                schedule_date__lt=today,
                is_active=True
            ).count()
            
            # Calculate attendance statistics for the unit
            unit_attendances = Attendance.objects.filter(
                class_schedule__semester_unit=unit
            )
            total_attendances = unit_attendances.count()
            present_attendances = unit_attendances.filter(
                status__in=['PRESENT', 'LATE']
            ).count()
            
            average_attendance = round(
                (present_attendances / total_attendances * 100), 2
            ) if total_attendances > 0 else 0.0
            
            # Create unit data dictionary
            unit_data = {
                'id': unit.id,
                'unit_object': unit,
                'code': unit.unit.code,
                'name': unit.unit.name,
                'credit_hours': unit.unit.credit_hours,
                'department': unit.unit.department.name,
                'semester': unit.semester.name,
                'enrolled_students_count': enrolled_students_count,
                'completed_classes': completed_classes,
                'average_attendance': average_attendance,
                'total_attendances': total_attendances,
                'present_attendances': present_attendances,
            }
            units_list.append(unit_data)
            
            print(f"DEBUG: Unit {unit.unit.code} - Students: {enrolled_students_count}, Classes: {completed_classes}")

        # ==================== CLASSES DATA WITH CORRECT STATUS ====================
        print(f"DEBUG: Fetching classes data with correct status")
        
        # Get all classes for the lecturer
        classes = ClassSchedule.objects.filter(
            lecturer=lecturer,
            is_active=True
        ).order_by('-schedule_date', 'start_time').select_related(
            'semester_unit__unit'
        )

        # Today's classes with CORRECT status
        todays_classes = ClassSchedule.objects.filter(
            lecturer=lecturer,
            schedule_date=today,
            is_active=True
        ).select_related('semester_unit__unit')

        # Create today's classes list with CORRECT status fields
        todays_classes_list = []
        for class_obj in todays_classes:
            # Use the new status function
            status = get_class_status(class_obj)
            is_ongoing = status == 'ONGOING'
            can_generate_qr_code = can_generate_qr(class_obj)
            
            # Get enrolled students count
            enrolled_students_count = StudentUnitEnrollment.objects.filter(
                semester_unit=class_obj.semester_unit,
                is_active=True
            ).count()
            
            class_data = {
                'object': class_obj,
                'status': status,  # Add status field
                'is_ongoing': is_ongoing,
                'can_generate_qr': can_generate_qr_code,  # Add QR generation capability
                'enrolled_students_count': enrolled_students_count,
                'unit_code': class_obj.semester_unit.unit.code,
                'unit_name': class_obj.semester_unit.unit.name,
                'venue': class_obj.venue,
                'start_time': class_obj.start_time,
                'end_time': class_obj.end_time,
            }
            todays_classes_list.append(class_data)

        # Upcoming classes (next 7 days) with status
        upcoming_start = today + timedelta(days=1)
        upcoming_end = today + timedelta(days=7)
        upcoming_classes = ClassSchedule.objects.filter(
            lecturer=lecturer,
            schedule_date__range=[upcoming_start, upcoming_end],
            is_active=True
        ).order_by('schedule_date', 'start_time').select_related('semester_unit__unit')

        # Create upcoming classes list with status
        upcoming_classes_list = []
        for class_obj in upcoming_classes:
            status = get_class_status(class_obj)
            enrolled_students_count = StudentUnitEnrollment.objects.filter(
                semester_unit=class_obj.semester_unit,
                is_active=True
            ).count()
            
            upcoming_class_data = {
                'object': class_obj,
                'status': status,
                'enrolled_students_count': enrolled_students_count,
                'unit_code': class_obj.semester_unit.unit.code,
                'unit_name': class_obj.semester_unit.unit.name,
            }
            upcoming_classes_list.append(upcoming_class_data)

        # All classes for manual attendance dropdown
        all_classes = ClassSchedule.objects.filter(
            lecturer=lecturer,
            is_active=True
        ).order_by('-schedule_date').select_related('semester_unit__unit')

        # ==================== ATTENDANCE DATA ====================
        print(f"DEBUG: Fetching attendance data")
        
        # Recent attendance data for analytics
        recent_attendance = []
        recent_classes = ClassSchedule.objects.filter(
            lecturer=lecturer,
            schedule_date__lte=today
        ).order_by('-schedule_date')[:10]

        for class_obj in recent_classes:
            total_students = StudentUnitEnrollment.objects.filter(
                semester_unit=class_obj.semester_unit,
                is_active=True
            ).count()
            
            present_count = Attendance.objects.filter(
                class_schedule=class_obj,
                status__in=['PRESENT', 'LATE']
            ).count()
            
            attendance_percentage = round(
                (present_count / total_students * 100), 2
            ) if total_students > 0 else 0.0
            
            recent_attendance.append({
                'class_id': class_obj.id,
                'unit_code': class_obj.semester_unit.unit.code,
                'unit_name': class_obj.semester_unit.unit.name,
                'date': class_obj.schedule_date,
                'total_students': total_students,
                'total_present': present_count,
                'attendance_percentage': attendance_percentage
            })

        # ==================== REPORTS DATA ====================
        reports = AttendanceReport.objects.filter(
            generated_by=lecturer
        ).order_by('-generated_at')[:10]

        # ==================== STATISTICS ====================
        print(f"DEBUG: Calculating statistics")
        
        # Comprehensive teaching statistics
        total_students = StudentUnitEnrollment.objects.filter(
            semester_unit__lecturer=lecturer,
            is_active=True
        ).values('student').distinct().count()

        total_classes = ClassSchedule.objects.filter(
            lecturer=lecturer,
            schedule_date__lte=today,
            is_active=True
        ).count()

        # Calculate overall attendance percentage
        all_attendances = Attendance.objects.filter(
            class_schedule__lecturer=lecturer
        )
        total_attendance_records = all_attendances.count()
        present_attendance_records = all_attendances.filter(
            status__in=['PRESENT', 'LATE']
        ).count()
        
        overall_attendance_percentage = round(
            (present_attendance_records / total_attendance_records * 100), 2
        ) if total_attendance_records > 0 else 0.0

        # ==================== UNIT DETAILS ====================
        unit_id = request.GET.get('unit_id')
        unit_detail_data = None
        enrolled_students = None
        attendance_summary = None

        if unit_id:
            try:
                unit_detail_data = get_object_or_404(SemesterUnit, id=unit_id, lecturer=lecturer)
                enrolled_students = StudentUnitEnrollment.objects.filter(
                    semester_unit=unit_detail_data,
                    is_active=True
                ).select_related('student__user')

                # Detailed attendance summary for the unit
                attendance_summary = Attendance.objects.filter(
                    class_schedule__semester_unit=unit_detail_data
                ).values('student').annotate(
                    total_classes=Count('id'),
                    present_classes=Sum(
                        Case(
                            When(status__in=['PRESENT', 'LATE'], then=1),
                            default=0,
                            output_field=IntegerField()
                        )
                    )
                ).annotate(
                    attendance_rate=ExpressionWrapper(
                        F('present_classes') * 1.0 / F('total_classes') * 100.0,
                        output_field=FloatField()
                    )
                )
            except Exception as e:
                logger.error(f"Error loading unit details for unit_id={unit_id}: {str(e)}")
                messages.error(request, "Error loading unit details.")

        # ==================== FINAL CONTEXT ====================
        print(f"DEBUG: Final context preparation")
        print(f"DEBUG: Units count in context: {len(units_list)}")
        print(f"DEBUG: Total students: {total_students}")
        print(f"DEBUG: Today's classes: {len(todays_classes_list)}")
        
        context = {
            'lecturer': lecturer,
            'units': units_list,  # Use the processed list with all data
            'units_count': len(units_list),  # Explicit count for display
            'classes': classes,
            'todays_classes': todays_classes_list,  # Use processed list with status
            'upcoming_classes': upcoming_classes_list,  # Use processed list with status
            'all_classes': all_classes,
            'reports': reports,
            'recent_attendance': recent_attendance,
            'active_tab': active_tab,
            'unit_detail': unit_detail_data,
            'enrolled_students': enrolled_students,
            'attendance_summary': attendance_summary,
            
            # Statistics
            'total_students': total_students,
            'total_classes': total_classes,
            'present_students': present_attendance_records,
            'overall_attendance_percentage': overall_attendance_percentage,
            
            # Today's date for templates
            'today': today,
            'now': now,
            
            # Debug info (remove in production)
            'debug_mode': True,
        }

        return render(request, 'lecturer/lecturer.html', context)
        
    except Exception as e:
        logger.error(f"Error in lecturer_portal for user={request.user.username}: {str(e)}")
        import traceback
        traceback.print_exc()
        messages.error(request, "Error loading portal data. Please try again.")
        
        # Return minimal context in case of error
        return render(request, 'lecturer/lecturer.html', {
            'lecturer': lecturer,
            'units': [],
            'units_count': 0,
            'classes': [],
            'todays_classes': [],
            'upcoming_classes': [],
            'all_classes': [],
            'reports': [],
            'recent_attendance': [],
            'active_tab': active_tab,
            'total_students': 0,
            'total_classes': 0,
            'present_students': 0,
            'overall_attendance_percentage': 0,
            'debug_mode': True,
        })

@lecturer_required
def schedule_class(request):
    """Schedule class with transaction safety"""
    try:
        lecturer = request.user.lecturer_profile
    except LecturerProfile.DoesNotExist:
        messages.error(request, "Lecturer profile not found.")
        return redirect('profile')

    if request.method == 'POST':
        form = ClassScheduleForm(request.POST, lecturer=lecturer)
        if form.is_valid():
            try:
                with transaction.atomic():
                    class_schedule = form.save(commit=False)
                    class_schedule.lecturer = lecturer
                    class_schedule.save()

                    log_system_action(
                        request.user, 
                        SystemLog.ActionType.CREATE,
                        f"Class scheduled: {class_schedule.semester_unit.unit.name} on {class_schedule.schedule_date}"
                    )
                messages.success(request, 'Class scheduled successfully!')
                return HttpResponseRedirect(reverse('lecturer_portal') + '?tab=classes')
            except Exception as e:
                logger.error("Error scheduling class for lecturer=%s: %s", lecturer.id, str(e))
                messages.error(request, 'Error scheduling class. Please try again.')
    else:
        form = ClassScheduleForm(lecturer=lecturer)

    context = {
        'form': form,
        'lecturer': lecturer
    }
    return render(request, 'lecturer/lecturer.html', context)

@lecturer_required
def lecturer_attendance(request):
    """Combined attendance and reports management"""
    try:
        lecturer = request.user.lecturer_profile
    except LecturerProfile.DoesNotExist:
        messages.error(request, "Lecturer profile not found.")
        return redirect('profile')
        
    active_tab = request.GET.get('tab', 'attendance')

    try:
        # Get today's classes for quick access
        today = timezone.now().date()
        todays_classes = ClassSchedule.objects.filter(
            lecturer=lecturer,
            schedule_date=today,
            is_active=True
        )

        # Add status to each class
        for class_obj in todays_classes:
            class_obj.status = get_class_status(class_obj)
            class_obj.can_generate_qr = can_generate_qr(class_obj)

        # Get recent reports
        reports = AttendanceReport.objects.filter(generated_by=lecturer).order_by('-generated_at')[:10]

        # Get all classes for manual attendance
        all_classes = ClassSchedule.objects.filter(lecturer=lecturer).order_by('-schedule_date')

        # Get specific class attendance if class_id provided
        class_id = request.GET.get('class_id')
        class_attendance_data = None
        enrolled_students = None
        if class_id:
            class_attendance_data = get_object_or_404(ClassSchedule, id=class_id, lecturer=lecturer)
            enrolled_students = StudentUnitEnrollment.objects.filter(
                semester_unit=class_attendance_data.semester_unit
            ).select_related('student__user')

        context = {
            'lecturer': lecturer,
            'todays_classes': todays_classes,
            'all_classes': all_classes,
            'reports': reports,
            'active_tab': active_tab,
            'class_attendance': class_attendance_data,
            'enrolled_students': enrolled_students,
        }
        return render(request, 'lecturer/attendance.html', context)
    except Exception as e:
        logger.error("Error loading lecturer attendance for user=%s: %s", request.user.username, str(e))
        messages.error(request, "Error loading attendance data.")
        return render(request, 'lecturer/attendance.html', {'lecturer': lecturer})

@lecturer_required
def generate_qr_code(request, class_id):
    """Generate QR code with proper status validation"""
    try:
        with transaction.atomic():
            class_schedule = get_object_or_404(
                ClassSchedule.objects.select_for_update(), 
                id=class_id, 
                lecturer=request.user.lecturer_profile
            )

            # Use the new status check
            if not can_generate_qr(class_schedule):
                return JsonResponse({
                    'success': False, 
                    'message': 'QR code can only be generated during ongoing classes.'
                }, status=400)

            # Check if valid QR code already exists
            existing_qr = QRCode.objects.filter(
                class_schedule=class_schedule, 
                is_active=True,
                expires_at__gt=timezone.now()
            ).first()
            
            if existing_qr:
                return JsonResponse({
                    'success': False, 
                    'message': 'Active QR code already exists for this class.'
                }, status=400)

            # Create new QR code
            qr_token = secrets.token_urlsafe(32)
            expires_at = timezone.now() + timedelta(minutes=QR_CODE_EXPIRY_MINUTES)

            qr_code = QRCode.objects.create(
                class_schedule=class_schedule,
                token=qr_token,
                expires_at=expires_at
            )

            # Generate QR code image
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr_data = {
                'token': qr_token,
                'class_id': str(class_schedule.id),
                'expires_at': expires_at.isoformat()
            }
            qr.add_data(json.dumps(qr_data))
            qr.make(fit=True)

            img = qr.make_image(fill_color="black", back_color="white")
            buffer = BytesIO()
            img.save(buffer, format='PNG')

            safe_filename = f'qr_{qr_token}.png'
            qr_code.qr_code_image.save(safe_filename, ContentFile(buffer.getvalue()))
            qr_code.save()

            log_system_action(
                request.user, 
                SystemLog.ActionType.CREATE,
                f"QR code generated for class: {class_schedule.semester_unit.unit.name}"
            )
            
            return JsonResponse({
                'success': True,
                'message': 'QR code generated successfully!',
                'token': qr_token,
                'expires_at': expires_at.isoformat(),
                'class_name': class_schedule.semester_unit.unit.name
            })
            
    except Exception as e:
        logger.error("Error generating QR code for class_id=%s: %s", class_id, str(e))
        return JsonResponse({
            'success': False, 
            'message': 'Error generating QR code. Please try again.'
        }, status=500)

@lecturer_required
def mark_attendance_manual(request, class_id):
    """Mark manual attendance with transaction safety"""
    class_schedule = get_object_or_404(ClassSchedule, id=class_id, lecturer=request.user.lecturer_profile)

    if request.method == 'POST':
        student_id = request.POST.get('student_id')
        status = request.POST.get('status')
        notes = request.POST.get('notes', '')

        if not student_id or not status:
            messages.error(request, 'Missing required fields.')
            return HttpResponseRedirect(reverse('lecturer_attendance') + f'?class_id={class_id}')

        try:
            with transaction.atomic():
                student = get_object_or_404(StudentProfile, id=student_id)

                # Use update_or_create for atomic operation
                attendance, created = Attendance.objects.update_or_create(
                    student=student,
                    class_schedule=class_schedule,
                    defaults={
                        'status': status,
                        'marked_by_lecturer': True,
                        'notes': notes
                    }
                )

                log_system_action(
                    request.user, 
                    SystemLog.ActionType.UPDATE,
                    f"Manual attendance marked for {student.registration_number}"
                )
                messages.success(request, f'Attendance marked for {student.user.get_full_name()}')
                
        except Exception as e:
            logger.error("Error marking manual attendance for student_id=%s: %s", student_id, str(e))
            messages.error(request, 'Error marking attendance. Please try again.')

    return HttpResponseRedirect(reverse('lecturer_attendance') + f'?class_id={class_id}')

@lecturer_required
def generate_report(request):
    """Generate attendance report with transaction safety"""
    try:
        lecturer = request.user.lecturer_profile
    except LecturerProfile.DoesNotExist:
        messages.error(request, "Lecturer profile not found.")
        return redirect('profile')

    if request.method == 'POST':
        form = AttendanceReportForm(request.POST, lecturer=lecturer)
        if form.is_valid():
            try:
                with transaction.atomic():
                    report = form.save(commit=False)
                    report.generated_by = lecturer
                    
                    # Implement calculate_statistics on AttendanceReport model
                    try:
                        report.calculate_statistics()
                    except Exception as e:
                        logger.error("Error calculating report statistics: %s", str(e))
                        messages.warning(request, "Report generated with limited statistics due to calculation errors.")
                    
                    report.is_generated = True
                    report.save()

                    log_system_action(
                        request.user, 
                        SystemLog.ActionType.REPORT,
                        f"Attendance report generated: {report.title}"
                    )
                messages.success(request, 'Report generated successfully!')
                return HttpResponseRedirect(reverse('lecturer_attendance') + '?tab=reports')
            except Exception as e:
                logger.error("Error generating report for lecturer=%s: %s", lecturer.id, str(e))
                messages.error(request, 'Error generating report. Please try again.')
    else:
        form = AttendanceReportForm(lecturer=lecturer)

    context = {
        'form': form,
        'lecturer': lecturer
    }
    return render(request, 'lecturer/attendance.html', context)

# ---------------------------
# Student Views - UPDATED FOR QR SYSTEM
# ---------------------------

@student_required
def student_dashboard(request):
    """Student dashboard with proper error handling"""
    try:
        student = request.user.student_profile
    except StudentProfile.DoesNotExist:
        logger.error("student_dashboard: user=%s missing student_profile", request.user.username)
        messages.error(request, "Student profile not found. Contact admin.")
        return redirect('login')

    today = timezone.now().date()

    try:
        # Student's statistics
        enrolled_units = StudentUnitEnrollment.objects.filter(student=student, is_active=True).count()

        # Today's classes with CORRECT ongoing status
        todays_classes = ClassSchedule.objects.filter(
            semester_unit__enrolled_students__student=student,
            schedule_date=today,
            is_active=True
        ).distinct().select_related('semester_unit__unit')

        # Mark status for classes using new function
        for class_obj in todays_classes:
            class_obj.status = get_class_status(class_obj)
            class_obj.is_ongoing = class_obj.status == 'ONGOING'

        # Get attended classes for today
        attended_today = Attendance.objects.filter(
            student=student,
            class_schedule__schedule_date=today
        ).values_list('class_schedule_id', flat=True)

        # Upcoming classes (next 7 days)
        upcoming_start = today + timedelta(days=1)
        upcoming_end = today + timedelta(days=7)
        upcoming_classes = ClassSchedule.objects.filter(
            semester_unit__enrolled_students__student=student,
            schedule_date__range=[upcoming_start, upcoming_end],
            is_active=True
        ).distinct().order_by('schedule_date', 'start_time').select_related('semester_unit__unit')

        # Recent attendance
        recent_attendance = Attendance.objects.filter(
            student=student
        ).select_related('class_schedule__semester_unit__unit').order_by('-class_schedule__schedule_date')[:5]

        # Calculate statistics
        total_attendances = Attendance.objects.filter(student=student)
        total_classes = total_attendances.count()
        present_classes = total_attendances.filter(status__in=['PRESENT', 'LATE']).count()
        attendance_percentage = (present_classes / total_classes * 100) if total_classes > 0 else 0

        context = {
            'student': student,
            'enrolled_units': enrolled_units,
            'todays_classes': todays_classes,
            'upcoming_classes': upcoming_classes,
            'recent_attendance': recent_attendance,
            'total_classes': total_classes,
            'present_classes': present_classes,
            'attendance_percentage': round(attendance_percentage, 2),
            'attended_class_ids': list(attended_today),
        }
        return render(request, 'student/dashboard.html', context)
    except Exception as e:
        logger.error("Error loading student dashboard for user=%s: %s", request.user.username, str(e))
        messages.error(request, "Error loading dashboard data.")
        return render(request, 'student/dashboard.html', {'student': student})

@student_required
def student_portal(request):
    """Combined portal for classes, units, and attendance with COMPLETE QR context"""
    try:
        student = request.user.student_profile
    except StudentProfile.DoesNotExist:
        logger.error("student_portal: user=%s missing student_profile", request.user.username)
        messages.error(request, "Student profile not found. Contact admin.")
        return redirect('login')

    active_tab = request.GET.get('tab', 'classes')
    today = timezone.now().date()
    now = timezone.now()

    try:
        # Get all data for the combined portal
        unit_enrollments = StudentUnitEnrollment.objects.filter(
            student=student, is_active=True
        ).select_related('semester_unit__unit', 'semester_unit__semester', 'semester_unit__lecturer__user')

        # Calculate attendance percentage for each unit
        for enrollment in unit_enrollments:
            unit_attendances = Attendance.objects.filter(
                student=student,
                class_schedule__semester_unit=enrollment.semester_unit
            )
            total_classes = unit_attendances.count()
            present_classes = unit_attendances.filter(status__in=['PRESENT', 'LATE']).count()
            enrollment.attendance_percentage = (present_classes / total_classes * 100) if total_classes > 0 else 0

        # Get classes for the student
        classes = ClassSchedule.objects.filter(
            semester_unit__enrolled_students__student=student,
            is_active=True
        ).distinct().order_by('-schedule_date', 'start_time').select_related('semester_unit__unit')

        # Get attendance records
        attendances = Attendance.objects.filter(student=student).select_related(
            'class_schedule__semester_unit__unit'
        ).order_by('-class_schedule__schedule_date')

        # Calculate statistics safely
        total_classes = attendances.count()
        present_classes = attendances.filter(status__in=['PRESENT', 'LATE']).count()
        late_count = attendances.filter(status='LATE').count()
        absent_count = attendances.filter(status='ABSENT').count()
        attendance_percentage = (present_classes / total_classes * 100) if total_classes > 0 else 0

        # Get today's classes and identify ongoing ones with CORRECT status
        todays_classes = ClassSchedule.objects.filter(
            semester_unit__enrolled_students__student=student,
            schedule_date=today,
            is_active=True
        ).distinct().select_related('semester_unit__unit', 'lecturer__user')

        # Mark status for classes and check attendance
        ongoing_classes = []
        attended_class_ids = []
        
        for class_obj in todays_classes:
            class_obj.status = get_class_status(class_obj)
            class_obj.is_ongoing = class_obj.status == 'ONGOING'
            
            # Check if attendance is already marked for this class
            attendance_exists = Attendance.objects.filter(
                student=student,
                class_schedule=class_obj
            ).exists()
            
            if attendance_exists:
                attended_class_ids.append(class_obj.id)
            
            if class_obj.is_ongoing:
                ongoing_classes.append(class_obj)

        # Get upcoming classes (next 7 days)
        upcoming_start = today + timedelta(days=1)
        upcoming_end = today + timedelta(days=7)
        upcoming_classes = ClassSchedule.objects.filter(
            semester_unit__enrolled_students__student=student,
            schedule_date__range=[upcoming_start, upcoming_end],
            is_active=True
        ).distinct().order_by('schedule_date', 'start_time')

        # Get recent attendances for the attendance tab
        recent_attendances = attendances[:5]

        context = {
            'student': student,
            'unit_enrollments': unit_enrollments,
            'classes': classes,
            'attendances': attendances,
            'recent_attendances': recent_attendances,
            'todays_classes': todays_classes,
            'upcoming_classes': upcoming_classes,
            'total_classes': total_classes,
            'present_classes': present_classes,
            'late_count': late_count,
            'absent_count': absent_count,
            'attendance_percentage': round(attendance_percentage, 2),
            'active_tab': active_tab,
            'today': today,
            'enrolled_units': unit_enrollments.count(),
            'attended_class_ids': attended_class_ids,
            'ongoing_classes': ongoing_classes,
        }

        # Get unit-specific attendance if unit_id provided
        unit_id = request.GET.get('unit_id')
        if unit_id:
            try:
                unit_attendance_data = get_object_or_404(SemesterUnit, id=unit_id)
                if StudentUnitEnrollment.objects.filter(student=student, semester_unit=unit_attendance_data).exists():
                    unit_attendances = Attendance.objects.filter(
                        student=student,
                        class_schedule__semester_unit=unit_attendance_data
                    ).select_related('class_schedule').order_by('class_schedule__schedule_date')

                    unit_total_classes = unit_attendances.count()
                    unit_present_classes = unit_attendances.filter(status__in=['PRESENT', 'LATE']).count()
                    unit_attendance_percentage = (unit_present_classes / unit_total_classes * 100) if unit_total_classes > 0 else 0

                    context.update({
                        'unit_attendance': unit_attendance_data,
                        'unit_attendances': unit_attendances,
                        'unit_total_classes': unit_total_classes,
                        'unit_present_classes': unit_present_classes,
                        'unit_attendance_percentage': round(unit_attendance_percentage, 2),
                    })
            except Exception as e:
                logger.error("Error loading unit attendance for unit_id=%s: %s", unit_id, str(e))

        return render(request, 'student/student.html', context)
    except Exception as e:
        logger.error("Error loading student portal for user=%s: %s", request.user.username, str(e))
        messages.error(request, "Error loading portal data.")
        return render(request, 'student/student.html', {'student': student})

@student_required
@csrf_exempt
def scan_qr_code(request):
    """
    QR code scanning endpoint with complete validation and attendance recording.
    This is the core function that makes the QR system work.
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Invalid request method'}, status=405)

    try:
        data = json.loads(request.body)
    except ValueError:
        return JsonResponse({'success': False, 'message': 'Invalid JSON payload'}, status=400)

    try:
        qr_token = data.get('token')
        class_id = data.get('class_id')
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        accuracy = data.get('accuracy')

        # Validate required fields
        if not qr_token:
            return JsonResponse({'success': False, 'message': 'Missing QR token'}, status=400)
        
        if not class_id:
            return JsonResponse({'success': False, 'message': 'Missing class ID'}, status=400)

        # Use transaction for atomic operation
        with transaction.atomic():
            # Get class schedule
            class_schedule = get_object_or_404(
                ClassSchedule.objects.select_for_update(),
                id=class_id
            )

            # Validate QR token
            is_valid, qr_code, error_message = validate_qr_token(qr_token, class_schedule)
            
            if not is_valid:
                return JsonResponse({'success': False, 'message': error_message}, status=400)

            # Safely get student profile
            try:
                student = request.user.student_profile
            except StudentProfile.DoesNotExist:
                return JsonResponse({'success': False, 'message': 'Student profile not found'}, status=403)

            # Check if student is enrolled in this unit
            if not StudentUnitEnrollment.objects.filter(
                student=student,
                semester_unit=class_schedule.semester_unit
            ).exists():
                return JsonResponse({'success': False, 'message': 'You are not enrolled in this unit'}, status=403)

            # Check if attendance is already marked for this class
            existing_attendance = Attendance.objects.filter(
                student=student,
                class_schedule=class_schedule
            ).first()

            if existing_attendance:
                return JsonResponse({
                    'success': False, 
                    'message': 'Attendance already marked for this class'
                }, status=400)

            # Validate location if provided
            location_valid = False
            if latitude and longitude:
                try:
                    location_valid = validate_location(
                        float(latitude),
                        float(longitude),
                        float(class_schedule.latitude),
                        float(class_schedule.longitude),
                        class_schedule.location_radius or LOCATION_RADIUS_METERS
                    )
                    logger.info(f"Location validation result: {location_valid}")
                except (TypeError, ValueError) as e:
                    logger.error("scan_qr_code: invalid location data: %s", str(e))
                    location_valid = False
            else:
                logger.warning("No location data provided for QR scan")

            # Create attendance record
            attendance = Attendance.objects.create(
                student=student,
                class_schedule=class_schedule,
                qr_code=qr_code,
                status=Attendance.AttendanceStatus.PRESENT,
                scan_time=timezone.now(),
                scan_latitude=latitude,
                scan_longitude=longitude,
                location_accuracy=accuracy,
                location_valid=location_valid,
            )

            # Deactivate QR code after successful scan to prevent reuse
            qr_code.is_active = False
            qr_code.save()

        # Log successful scan
        log_system_action(
            request.user, 
            SystemLog.ActionType.SCAN,
            f"QR code scanned for class: {class_schedule.semester_unit.unit.name}",
            {
                'class_id': str(class_schedule.id),
                'unit_name': class_schedule.semester_unit.unit.name,
                'location_valid': location_valid,
                'scan_time': timezone.now().isoformat()
            }
        )

        return JsonResponse({
            'success': True,
            'message': 'Attendance marked successfully!',
            'location_valid': location_valid,
            'attendance_id': str(attendance.id),
            'class_name': class_schedule.semester_unit.unit.name,
            'scan_time': attendance.scan_time.isoformat()
        })

    except Http404:
        return JsonResponse({'success': False, 'message': 'Class not found'}, status=404)
    except Exception as e:
        logger.error("Error processing QR scan: %s", str(e))
        return JsonResponse({'success': False, 'message': 'Failed to process scan'}, status=500)

# ---------------------------
# API Views
# ---------------------------

def api_required(view_func):
    """Decorator for API endpoints that require authentication"""
    @wraps(view_func)
    def wrapped_view(request, *args, **kwargs):
        if not getattr(request.user, 'is_authenticated', False):
            return JsonResponse({'error': 'Authentication required'}, status=401)
        return view_func(request, *args, **kwargs)
    return wrapped_view

@api_required
def api_student_attendance(request, student_id):
    """API endpoint to get student attendance data"""
    # Admins or lecturers with access can view
    if not is_admin(request.user) and not (is_lecturer(request.user) and has_access_to_student(request.user.lecturer_profile, student_id)):
        return JsonResponse({'error': 'Permission denied'}, status=403)

    try:
        student = get_object_or_404(StudentProfile, id=student_id)
        attendances = Attendance.objects.filter(student=student).values(
            'class_schedule__semester_unit__unit__name',
            'class_schedule__schedule_date',
            'status',
            'scan_time'
        ).order_by('-class_schedule__schedule_date')

        return JsonResponse(list(attendances), safe=False)
    except Exception as e:
        logger.error("Error fetching student attendance for student_id=%s: %s", student_id, str(e))
        return JsonResponse({'error': 'Unable to fetch attendance data'}, status=500)

@api_required
def api_class_attendance(request, class_id):
    """API endpoint to get class attendance data"""
    try:
        class_schedule = get_object_or_404(ClassSchedule, id=class_id)

        if not is_admin(request.user) and not (is_lecturer(request.user) and class_schedule.lecturer.user == request.user):
            return JsonResponse({'error': 'Permission denied'}, status=403)

        attendances = Attendance.objects.filter(class_schedule=class_schedule).values(
            'student__registration_number',
            'student__user__first_name',
            'student__user__last_name',
            'status',
            'scan_time',
            'location_valid'
        )

        return JsonResponse(list(attendances), safe=False)
    except Exception as e:
        logger.error("Error fetching class attendance for class_id=%s: %s", class_id, str(e))
        return JsonResponse({'error': 'Unable to fetch attendance data'}, status=500)

# ---------------------------
# Additional Student Views
# ---------------------------

@student_required
def student_attendance_history(request):
    """Detailed attendance history for students"""
    student = request.user.student_profile
    attendances = Attendance.objects.filter(student=student).select_related(
        'class_schedule__semester_unit__unit'
    ).order_by('-class_schedule__schedule_date')
    
    context = {
        'student': student,
        'attendances': attendances,
    }
    return render(request, 'student/attendance_history.html', context)

@student_required
def student_unit_attendance(request, unit_id):
    """Unit-specific attendance for students"""
    student = request.user.student_profile
    unit = get_object_or_404(SemesterUnit, id=unit_id)
    
    # Verify enrollment
    if not StudentUnitEnrollment.objects.filter(student=student, semester_unit=unit).exists():
        raise PermissionDenied("Not enrolled in this unit")
    
    attendances = Attendance.objects.filter(
        student=student,
        class_schedule__semester_unit=unit
    ).select_related('class_schedule').order_by('class_schedule__schedule_date')
    
    context = {
        'student': student,
        'unit': unit,
        'attendances': attendances,
    }
    return render(request, 'student/unit_attendance.html', context)

# ---------------------------
# Utility functions
# ---------------------------

def has_access_to_student(lecturer, student_id):
    """Check if lecturer has access to student's data with proper error handling"""
    try:
        student = get_object_or_404(StudentProfile, id=student_id)
        return StudentUnitEnrollment.objects.filter(
            student=student,
            semester_unit__lecturer=lecturer
        ).exists()
    except Exception as e:
        logger.error("Error checking access to student=%s for lecturer=%s: %s", student_id, lecturer.id, str(e))
        return False

# ---------------------------
# Additional API Views
# ---------------------------

@api_required
def api_class_list(request):
    """API endpoint for class list"""
    if is_lecturer(request.user):
        classes = ClassSchedule.objects.filter(lecturer=request.user.lecturer_profile)
    elif is_student(request.user):
        classes = ClassSchedule.objects.filter(
            semester_unit__enrolled_students__student=request.user.student_profile
        )
    else:
        classes = ClassSchedule.objects.none()
    
    class_data = list(classes.values('id', 'schedule_date', 'start_time', 'end_time'))
    return JsonResponse(class_data, safe=False)

@api_required
def api_today_classes(request):
    """API endpoint for today's classes"""
    today = timezone.now().date()
    
    if is_lecturer(request.user):
        classes = ClassSchedule.objects.filter(
            lecturer=request.user.lecturer_profile,
            schedule_date=today
        )
    elif is_student(request.user):
        classes = ClassSchedule.objects.filter(
            semester_unit__enrolled_students__student=request.user.student_profile,
            schedule_date=today
        )
    else:
        classes = ClassSchedule.objects.none()
    
    class_data = list(classes.values('id', 'schedule_date', 'start_time', 'end_time'))
    return JsonResponse(class_data, safe=False)


@lecturer_required
@require_http_methods(["GET"])
def api_lecturer_recent_attendance(request):
    """API endpoint for lecturer's recent attendance data"""
    try:
        lecturer = request.user.lecturer_profile
        today = timezone.now().date()
        
        # Get recent classes (last 10)
        recent_classes = ClassSchedule.objects.filter(
            lecturer=lecturer,
            schedule_date__lte=today
        ).order_by('-schedule_date')[:10]
        
        attendance_data = []
        for class_schedule in recent_classes:
            total_students = StudentUnitEnrollment.objects.filter(
                semester_unit=class_schedule.semester_unit,
                is_active=True
            ).count()
            
            present_count = Attendance.objects.filter(
                class_schedule=class_schedule,
                status__in=['PRESENT', 'LATE']
            ).count()
            
            attendance_percentage = round(
                (present_count / total_students * 100), 2
            ) if total_students > 0 else 0.0
            
            attendance_data.append({
                'class_id': str(class_schedule.id),
                'unit_code': class_schedule.semester_unit.unit.code,
                'unit_name': class_schedule.semester_unit.unit.name,
                'date': class_schedule.schedule_date.isoformat(),
                'total_students': total_students,
                'total_present': present_count,
                'attendance_percentage': attendance_percentage
            })
        
        return JsonResponse({'attendance': attendance_data})
        
    except Exception as e:
        logger.error("Error in api_lecturer_recent_attendance: %s", str(e))
        return JsonResponse({'error': 'Unable to fetch attendance data'}, status=500)

@lecturer_required
@require_http_methods(["GET"])
def api_lecturer_classes(request):
    """API endpoint for lecturer's classes"""
    try:
        lecturer = request.user.lecturer_profile
        classes = ClassSchedule.objects.filter(lecturer=lecturer).values(
            'id', 'schedule_date', 'start_time', 'end_time', 'venue',
            'semester_unit__unit__code', 'semester_unit__unit__name'
        ).order_by('-schedule_date')
        
        return JsonResponse({'classes': list(classes)})
        
    except Exception as e:
        logger.error("Error in api_lecturer_classes: %s", str(e))
        return JsonResponse({'error': 'Unable to fetch classes data'}, status=500)

@lecturer_required
@require_http_methods(["GET"])
def api_lecturer_units(request):
    """API endpoint for lecturer's units with complete data"""
    try:
        lecturer = request.user.lecturer_profile
        units = SemesterUnit.objects.filter(lecturer=lecturer).values(
            'id', 'unit__code', 'unit__name', 'unit__credit_hours',
            'semester__name', 'max_students'
        )
        
        # Add current student counts
        units_data = list(units)
        for unit in units_data:
            unit['current_students'] = StudentUnitEnrollment.objects.filter(
                semester_unit_id=unit['id'],
                is_active=True
            ).count()
        
        return JsonResponse({'units': units_data})
        
    except Exception as e:
        logger.error("Error in api_lecturer_units: %s", str(e))
        return JsonResponse({'error': 'Unable to fetch units data'}, status=500)

@lecturer_required
@require_http_methods(["GET"])
def api_lecturer_reports(request):
    """API endpoint for lecturer's reports"""
    try:
        lecturer = request.user.lecturer_profile
        reports = AttendanceReport.objects.filter(generated_by=lecturer).values(
            'id', 'title', 'report_type', 'generated_at', 'is_generated'
        ).order_by('-generated_at')[:10]
        
        return JsonResponse({'reports': list(reports)})
        
    except Exception as e:
        logger.error("Error in api_lecturer_reports: %s", str(e))
        return JsonResponse({'error': 'Unable to fetch reports data'}, status=500)



@lecturer_required
@require_http_methods(["GET"])
def api_unit_analytics(request, unit_id):
    """API endpoint for unit analytics with complete data"""
    try:
        unit = get_object_or_404(SemesterUnit, id=unit_id, lecturer=request.user.lecturer_profile)
        
        # Calculate comprehensive attendance statistics
        attendances = Attendance.objects.filter(
            class_schedule__semester_unit=unit
        )
        
        present_count = attendances.filter(status='PRESENT').count()
        late_count = attendances.filter(status='LATE').count()
        absent_count = attendances.filter(status='ABSENT').count()
        total_count = present_count + late_count + absent_count
        
        attendance_percentage = round(
            (present_count + late_count) / total_count * 100, 2
        ) if total_count > 0 else 0.0
        
        # Get student performance data
        student_performance = StudentUnitEnrollment.objects.filter(
            semester_unit=unit,
            is_active=True
        )[:10]  # Top 10 students by enrollment date
        
        top_students = []
        for enrollment in student_performance:
            student_attendances = Attendance.objects.filter(
                student=enrollment.student,
                class_schedule__semester_unit=unit
            )
            total_student_classes = student_attendances.count()
            present_student_classes = student_attendances.filter(
                status__in=['PRESENT', 'LATE']
            ).count()
            
            attendance_rate = round(
                (present_student_classes / total_student_classes * 100), 2
            ) if total_student_classes > 0 else 0.0
            
            top_students.append({
                'name': enrollment.student.user.get_full_name() or enrollment.student.user.username,
                'registration_number': enrollment.student.registration_number,
                'attendance_rate': attendance_rate
            })
        
        # Sort by attendance rate (descending)
        top_students.sort(key=lambda x: x['attendance_rate'], reverse=True)
        
        unit_data = {
            'code': unit.unit.code,
            'name': unit.unit.name,
            'attendance_percentage': attendance_percentage,
            'present_count': present_count,
            'late_count': late_count,
            'absent_count': absent_count,
            'enrolled_students': StudentUnitEnrollment.objects.filter(
                semester_unit=unit, 
                is_active=True
            ).count(),
            'top_students': top_students[:5],  
            'chart_data': {
                'labels': ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                'rates': [75, 82, 78, 85]  # Mock data - you can implement real weekly data
            }
        }
        
        return JsonResponse({'unit_data': unit_data})
        
    except Exception as e:
        logger.error("Error in api_unit_analytics: %s", str(e))
        return JsonResponse({'error': 'Unable to fetch unit analytics'}, status=500)

@lecturer_required
@require_http_methods(["POST"])
def api_reports_preview(request):
    """API endpoint for report preview"""
    try:
        data = json.loads(request.body)
        # Return mock preview data for now
        preview_data = {
            'total_classes': 15,
            'average_attendance': 78.5,
            'total_students': 45,
            'date_range': f"{data.get('start_date')} to {data.get('end_date')}"
        }
        
        return JsonResponse({'success': True, 'preview_data': preview_data})
        
    except Exception as e:
        logger.error("Error in api_reports_preview: %s", str(e))
        return JsonResponse({'error': 'Unable to generate preview'}, status=500)


# ==================== MISSING API ENDPOINTS ====================

@lecturer_required
@require_http_methods(["POST"])
@csrf_exempt
def api_schedule_class(request):
    """API endpoint for scheduling classes - JSON version"""
    try:
        lecturer = request.user.lecturer_profile
    except LecturerProfile.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Lecturer profile not found'}, status=400)

    if request.method == 'POST':
        try:
            # Parse JSON data
            data = json.loads(request.body)
            print("Received class data:", data)  # Debug log
            
            # Basic validation
            required_fields = ['semester_unit', 'schedule_date', 'start_time', 'end_time', 'venue']
            for field in required_fields:
                if not data.get(field):
                    return JsonResponse({
                        'success': False, 
                        'message': f'Missing required field: {field}'
                    }, status=400)

            # Get the semester unit and verify it belongs to this lecturer
            try:
                semester_unit = SemesterUnit.objects.get(
                    id=data['semester_unit'],
                    lecturer=lecturer
                )
            except SemesterUnit.DoesNotExist:
                return JsonResponse({
                    'success': False, 
                    'message': 'Invalid unit selected or you are not assigned to teach this unit'
                }, status=400)

            # Create class schedule
            class_schedule = ClassSchedule(
                semester_unit=semester_unit,
                lecturer=lecturer,
                schedule_date=data['schedule_date'],
                start_time=data['start_time'],
                end_time=data['end_time'],
                venue=data['venue'],
                latitude=data.get('latitude'),
                longitude=data.get('longitude'),
                location_radius=data.get('location_radius', 100)
            )

            # Validate and save
            try:
                class_schedule.full_clean()  # This will run the clean() method
                class_schedule.save()

                log_system_action(
                    request.user, 
                    SystemLog.ActionType.CREATE,
                    f"Class scheduled: {class_schedule.semester_unit.unit.name} on {class_schedule.schedule_date}"
                )

                return JsonResponse({
                    'success': True, 
                    'message': 'Class scheduled successfully!',
                    'class_id': str(class_schedule.id)
                })

            except ValidationError as e:
                return JsonResponse({
                    'success': False, 
                    'message': 'Validation error: ' + str(e)
                }, status=400)

        except json.JSONDecodeError:
            return JsonResponse({
                'success': False, 
                'message': 'Invalid JSON data'
            }, status=400)
        except Exception as e:
            logger.error("Error in api_schedule_class: %s", str(e))
            return JsonResponse({
                'success': False, 
                'message': 'Server error: ' + str(e)
            }, status=500)

    return JsonResponse({'success': False, 'message': 'Invalid request method'}, status=405)

@lecturer_required
@require_http_methods(["GET"])
def api_class_attendance(request, class_id):
    """API endpoint for class attendance data - PRODUCTION READY"""
    try:
        class_schedule = get_object_or_404(ClassSchedule, id=class_id, lecturer=request.user.lecturer_profile)
        
        # Get enrolled students with their current attendance status
        enrolled_students = StudentUnitEnrollment.objects.filter(
            semester_unit=class_schedule.semester_unit,
            is_active=True
        ).select_related('student__user')
        
        students_data = []
        for enrollment in enrolled_students:
            # Check if attendance already marked
            attendance = Attendance.objects.filter(
                student=enrollment.student,
                class_schedule=class_schedule
            ).first()
            
            students_data.append({
                'id': str(enrollment.student.id),
                'name': enrollment.student.user.get_full_name() or enrollment.student.user.username,
                'registration_number': enrollment.student.registration_number,
                'current_status': attendance.status if attendance else 'ABSENT'
            })
        
        return JsonResponse({'students': students_data})
        
    except Exception as e:
        logger.error("Error in api_class_attendance: %s", str(e))
        return JsonResponse({'error': 'Unable to fetch class attendance data'}, status=500)

@lecturer_required
@require_http_methods(["POST"])
def api_mark_manual_attendance(request):
    """API endpoint for marking manual attendance"""
    try:
        data = json.loads(request.body)
        class_id = data.get('class_id')
        attendance_data = data.get('attendance', [])
        
        if not class_id:
            return JsonResponse({'success': False, 'message': 'Class ID is required'}, status=400)
        
        class_schedule = get_object_or_404(ClassSchedule, id=class_id, lecturer=request.user.lecturer_profile)
        
        with transaction.atomic():
            for record in attendance_data:
                student_id = record.get('student_id')
                status = record.get('status')
                
                if student_id and status:
                    student = get_object_or_404(StudentProfile, id=student_id)
                    
                    # Use update_or_create for atomic operation
                    attendance, created = Attendance.objects.update_or_create(
                        student=student,
                        class_schedule=class_schedule,
                        defaults={
                            'status': status,
                            'marked_by_lecturer': True
                        }
                    )
        
        log_system_action(
            request.user, 
            SystemLog.ActionType.UPDATE,
            f"Manual attendance marked for class: {class_schedule.semester_unit.unit.name}"
        )
        
        return JsonResponse({'success': True, 'message': 'Attendance saved successfully!'})
        
    except Exception as e:
        logger.error("Error in api_mark_manual_attendance: %s", str(e))
        return JsonResponse({'success': False, 'message': 'Error saving attendance'}, status=500)

# ---------------------------
# Error handlers
# ---------------------------

def handler403(request, exception):
    return render(request, 'errors/403.html', status=403)

def handler404(request, exception):
    return render(request, 'errors/404.html', status=404)

def handler500(request):
    return render(request, 'errors/500.html', status=500)