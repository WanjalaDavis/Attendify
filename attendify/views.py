import json
import secrets
import qrcode
import logging
from io import BytesIO
from datetime import datetime, timedelta
from functools import wraps

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, logout, authenticate, update_session_auth_hash
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib import messages
from django.http import Http404, JsonResponse, HttpResponse, HttpResponseRedirect
from django.db.models import Count, Q, Avg, Sum, Case, When, IntegerField, F, FloatField, ExpressionWrapper
from django.utils import timezone
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from django.urls import reverse, reverse_lazy
from django.core.files.base import ContentFile
from django.core.exceptions import PermissionDenied
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils.decorators import method_decorator
from django.conf import settings

from .models import *
from .forms import (
    UserCreationForm, UserUpdateForm, CustomPasswordChangeForm,
    StudentProfileForm, LecturerProfileForm, AdminProfileForm,
    DepartmentForm, CourseForm, SemesterForm, UnitForm,
    EnrollmentForm, SemesterUnitForm, ClassScheduleForm,
    AttendanceReportForm, QRScanForm, ManualAttendanceForm,
    DateRangeFilterForm, StudentSearchForm, AttendanceFilterForm
)
from django.views.decorators.cache import cache_page

logger = logging.getLogger(__name__)

# ---------------------------
# Utility / Role check helpers
# ---------------------------

def is_admin(user):
    return getattr(user, "is_authenticated", False) and getattr(user, "is_admin", False)

def is_lecturer(user):
    return getattr(user, "is_authenticated", False) and getattr(user, "is_lecturer", False)

def is_student(user):
    return getattr(user, "is_authenticated", False) and getattr(user, "is_student", False)

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
    except Exception:
        logger.exception("Failed to write system log")


# ---------------------------
# Dashboard redirect
# ---------------------------

@login_required
def dashboard_redirect(request):
    """Redirect to appropriate dashboard based on user type/flags."""
    user = request.user
    # Prefer explicit boolean flags if available
    if getattr(user, "is_admin", False):
        return redirect('/admin/')
    if getattr(user, "is_lecturer", False):
        return redirect('lecturer_dashboard')
    if getattr(user, "is_student", False):
        return redirect('student_dashboard')

    # Fallback to user_type field if present
    if hasattr(user, "user_type"):
        ut = getattr(user, "user_type")
        if ut == "ADMIN":
            return redirect('/admin/')
        if ut == "LECTURER":
            return redirect('lecturer_dashboard')
        if ut == "STUDENT":
            return redirect('student_dashboard')

    # Last-resort fallback
    logger.warning("dashboard_redirect: unknown user type for user=%s", getattr(user, "username", "<anonymous>"))
    return redirect('login')


# ---------------------------
# System APIs
# ---------------------------

@cache_page(60)  # Cache for 1 minute
def api_system_stats(request):
    """API endpoint for real-time system statistics"""
    today = timezone.now().date()

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
        'system_uptime': '99.9%',  # placeholder
    }

    return JsonResponse(stats)


# ---------------------------
# Authentication views
# ---------------------------

def login_view(request):
    """
    Login view that redirects users to the correct dashboard depending on their role.
    Uses boolean flags (is_admin/is_lecturer/is_student) when available, otherwise falls back to user_type.
    """
    # If user is already authenticated, send them to their dashboard
    if request.user.is_authenticated:
        logger.debug("User already authenticated: %s, flags: admin=%s lecturer=%s student=%s",
                     request.user.username,
                     getattr(request.user, 'is_admin', None),
                     getattr(request.user, 'is_lecturer', None),
                     getattr(request.user, 'is_student', None))
        return dashboard_redirect(request)

    # Gather stats for login page
    today = timezone.now().date()
    context = {
        'total_students': StudentProfile.objects.count(),
        'total_lecturers': LecturerProfile.objects.count(),
        'total_classes': ClassSchedule.objects.count(),
        'total_attendance_records': Attendance.objects.count(),
        'active_users': User.objects.filter(last_login__date=today, is_active=True).count(),
        'today_classes': ClassSchedule.objects.filter(schedule_date=today, is_active=True).count(),
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
    try:
        log_system_action(request.user, SystemLog.ActionType.LOGOUT, f"User {request.user.username} logged out")
    except Exception:
        logger.exception("Failed to log logout action for user=%s", getattr(request.user, 'username', '<unknown>'))
    logout(request)
    messages.info(request, 'You have been logged out successfully.')
    return redirect('login')


@login_required
def change_password(request):
    if request.method == 'POST':
        form = CustomPasswordChangeForm(request.user, request.POST)
        if form.is_valid():
            user = form.save()
            update_session_auth_hash(request, user)
            log_system_action(request.user, SystemLog.ActionType.UPDATE, "Password changed successfully")
            messages.success(request, 'Your password was successfully updated!')
            return redirect('profile')
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
    user = request.user
    context = {'user': user}

    # Prefer flag-based checks to avoid RelatedObjectDoesNotExist
    if getattr(user, 'is_student', False):
        if hasattr(user, 'student_profile'):
            context['profile'] = user.student_profile
            return render(request, 'student/dashboard.html', context)
        # student flag but no profile — log and show profile page
        logger.warning("profile_view: user %s has is_student flag but no student_profile", user.username)
        messages.warning(request, "Your student profile is not configured. Contact admin.")
        return render(request, 'profile/missing_profile.html', context)

    if getattr(user, 'is_lecturer', False):
        if hasattr(user, 'lecturer_profile'):
            context['profile'] = user.lecturer_profile
            return render(request, 'lecturer/dashboard.html', context)
        logger.warning("profile_view: user %s has is_lecturer flag but no lecturer_profile", user.username)
        messages.warning(request, "Your lecturer profile is not configured. Contact admin.")
        return render(request, 'profile/missing_profile.html', context)

    if getattr(user, 'is_admin', False):
        if hasattr(user, 'admin_profile'):
            context['profile'] = user.admin_profile
            return redirect('/admin/')
        # Admin without admin_profile: still redirect to admin if possible
        return redirect('/admin/')

    # fallback: attempt to use user_type attribute
    if hasattr(user, 'user_type'):
        ut = getattr(user, 'user_type')
        if ut == "STUDENT" and hasattr(user, 'student_profile'):
            context['profile'] = user.student_profile
            return render(request, 'student/dashboard.html', context)
        if ut == "LECTURER" and hasattr(user, 'lecturer_profile'):
            context['profile'] = user.lecturer_profile
            return render(request, 'lecturer/dashboard.html', context)
        if ut == "ADMIN" and hasattr(user, 'admin_profile'):
            context['profile'] = user.admin_profile
            return redirect('/admin/')

    # Unknown user type
    logger.error("profile_view: unknown user type for user=%s", getattr(user, 'username', '<anonymous>'))
    raise PermissionDenied("User profile missing or invalid user type")


@login_required
def profile_edit(request):
    user = request.user

    if request.method == 'POST':
        user_form = UserUpdateForm(request.POST, request.FILES, instance=user)

        # For profile forms that accept files, pass request.FILES
        if getattr(user, 'is_student', False) and hasattr(user, 'student_profile'):
            profile_form = StudentProfileForm(request.POST, request.FILES, instance=user.student_profile)
        elif getattr(user, 'is_lecturer', False) and hasattr(user, 'lecturer_profile'):
            profile_form = LecturerProfileForm(request.POST, request.FILES, instance=user.lecturer_profile)
        elif getattr(user, 'is_admin', False) and hasattr(user, 'admin_profile'):
            profile_form = AdminProfileForm(request.POST, request.FILES, instance=user.admin_profile)
        else:
            profile_form = None

        if user_form.is_valid() and (profile_form is None or profile_form.is_valid()):
            user_form.save()
            if profile_form:
                profile_form.save()
            log_system_action(user, SystemLog.ActionType.UPDATE, "Profile updated")
            messages.success(request, 'Profile updated successfully!')
            return redirect('profile')
        else:
            messages.error(request, 'Please correct the errors below.')
    else:
        user_form = UserUpdateForm(instance=user)
        if getattr(user, 'is_student', False) and hasattr(user, 'student_profile'):
            profile_form = StudentProfileForm(instance=user.student_profile)
        elif getattr(user, 'is_lecturer', False) and hasattr(user, 'lecturer_profile'):
            profile_form = LecturerProfileForm(instance=user.lecturer_profile)
        elif getattr(user, 'is_admin', False) and hasattr(user, 'admin_profile'):
            profile_form = AdminProfileForm(instance=user.admin_profile)
        else:
            profile_form = None

    context = {
        'user_form': user_form,
        'profile_form': profile_form,
        'user_type': getattr(user, 'user_type', None)
    }

    if getattr(user, 'is_student', False):
        return render(request, 'student/dashboard.html', context)
    elif getattr(user, 'is_lecturer', False):
        return render(request, 'lecturer/dashboard.html', context)
    elif getattr(user, 'is_admin', False):
        return redirect('/admin/')

    # fallback
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
# Lecturer Views
# ---------------------------

@lecturer_required
def lecturer_dashboard(request):
    lecturer = request.user.lecturer_profile    
    today = timezone.now().date()

    # Lecturer's statistics
    teaching_units = SemesterUnit.objects.filter(lecturer=lecturer).count()
    total_students = StudentUnitEnrollment.objects.filter(
        semester_unit__lecturer=lecturer
    ).values('student').distinct().count()

    # Today's classes
    todays_classes = ClassSchedule.objects.filter(
        lecturer=lecturer,
        schedule_date=today,
        is_active=True
    ).select_related('semester_unit__unit')

    # Upcoming classes (next 7 days)
    upcoming_start = today + timedelta(days=1)
    upcoming_end = today + timedelta(days=7)
    upcoming_classes = ClassSchedule.objects.filter(
        lecturer=lecturer,
        schedule_date__range=[upcoming_start, upcoming_end],
        is_active=True
    ).order_by('schedule_date', 'start_time').select_related('semester_unit__unit')

    # --- NEW: preload forms for profile modal (no change to profile_edit view) ---
    user_form = UserUpdateForm(instance=request.user)
    profile_form = LecturerProfileForm(instance=lecturer)

    context = {
        'lecturer': lecturer,
        'teaching_units': teaching_units,
        'total_students': total_students,
        'todays_classes': todays_classes,
        'upcoming_classes': upcoming_classes,
        # forms for modal
        'user_form': user_form,
        'profile_form': profile_form,
    }
    return render(request, 'lecturer/dashboard.html', context)


@lecturer_required
def lecturer_portal(request):
    """Combined portal for classes, units, and management"""
    lecturer = request.user.lecturer_profile
    active_tab = request.GET.get('tab', 'classes')

    # Get all data for the combined portal
    units = SemesterUnit.objects.filter(lecturer=lecturer).select_related('unit', 'semester')
    classes = ClassSchedule.objects.filter(lecturer=lecturer).order_by('-schedule_date', 'start_time').select_related('semester_unit__unit')

    # Get today's classes for quick access
    today = timezone.now().date()
    todays_classes = ClassSchedule.objects.filter(
        lecturer=lecturer,
        schedule_date=today,
        is_active=True
    )

    # Get unit details for the detail view
    unit_id = request.GET.get('unit_id')
    unit_detail_data = None
    enrolled_students = None
    attendance_summary = None

    if unit_id:
        unit_detail_data = get_object_or_404(SemesterUnit, id=unit_id, lecturer=lecturer)
        enrolled_students = StudentUnitEnrollment.objects.filter(
            semester_unit=unit_detail_data
        ).select_related('student__user')

        # Properly compute attendance summary: present count and rate
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

    context = {
        'lecturer': lecturer,
        'units': units,
        'classes': classes,
        'todays_classes': todays_classes,
        'active_tab': active_tab,
        'unit_detail': unit_detail_data,
        'enrolled_students': enrolled_students if unit_detail_data else None,
        'attendance_summary': attendance_summary if unit_detail_data else None,
    }
    return render(request, 'lecturer/lecturer.html', context)


@lecturer_required
def schedule_class(request):
    lecturer = request.user.lecturer_profile

    if request.method == 'POST':
        form = ClassScheduleForm(request.POST, lecturer=lecturer)
        if form.is_valid():
            class_schedule = form.save(commit=False)
            class_schedule.lecturer = lecturer
            class_schedule.save()

            log_system_action(request.user, SystemLog.ActionType.CREATE,
                              f"Class scheduled: {class_schedule.semester_unit.unit.name} on {class_schedule.schedule_date}")
            messages.success(request, 'Class scheduled successfully!')
            return HttpResponseRedirect(reverse('lecturer_portal') + '?tab=classes')
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
    lecturer = request.user.lecturer_profile
    active_tab = request.GET.get('tab', 'attendance')  # Default to attendance tab

    # Get today's classes for quick access
    today = timezone.now().date()
    todays_classes = ClassSchedule.objects.filter(
        lecturer=lecturer,
        schedule_date=today,
        is_active=True
    )

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


@lecturer_required
def generate_qr_code(request, class_id):
    class_schedule = get_object_or_404(ClassSchedule, id=class_id, lecturer=request.user.lecturer_profile)

    # Check if class is ongoing
    if not getattr(class_schedule, 'is_ongoing', False):
        messages.error(request, 'QR code can only be generated during class time.')
        return redirect('lecturer_attendance')

    # Check if QR code already exists and is valid
    existing_qr = QRCode.objects.filter(class_schedule=class_schedule, is_active=True).first()
    if existing_qr and not getattr(existing_qr, 'is_expired', False):
        messages.info(request, 'QR code already exists for this class.')
        return redirect('lecturer_attendance')

    # Create new QR code
    qr_token = secrets.token_urlsafe(32)
    expires_at = timezone.now() + timedelta(minutes=5)  # QR code expires in 5 minutes

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

    log_system_action(request.user, SystemLog.ActionType.CREATE,
                     f"QR code generated for class: {class_schedule.semester_unit.unit.name}")
    messages.success(request, 'QR code generated successfully!')
    return redirect('lecturer_attendance')


@lecturer_required
def mark_attendance_manual(request, class_id):
    class_schedule = get_object_or_404(ClassSchedule, id=class_id, lecturer=request.user.lecturer_profile)

    if request.method == 'POST':
        student_id = request.POST.get('student_id')
        status = request.POST.get('status')
        notes = request.POST.get('notes', '')

        student = get_object_or_404(StudentProfile, id=student_id)

        attendance, created = Attendance.objects.get_or_create(
            student=student,
            class_schedule=class_schedule,
            defaults={
                'status': status,
                'marked_by_lecturer': True,
                'notes': notes
            }
        )

        if not created:
            attendance.status = status
            attendance.marked_by_lecturer = True
            attendance.notes = notes
            attendance.save()

        log_system_action(request.user, SystemLog.ActionType.UPDATE,
                         f"Manual attendance marked for {student.registration_number}")
        messages.success(request, f'Attendance marked for {student.user.get_full_name()}')
        return HttpResponseRedirect(reverse('lecturer_attendance') + f'?class_id={class_id}')

    # This will be handled in the lecturer_attendance view
    return HttpResponseRedirect(reverse('lecturer_attendance') + f'?class_id={class_id}&tab=manual')


@lecturer_required
def generate_report(request):
    lecturer = request.user.lecturer_profile

    if request.method == 'POST':
        form = AttendanceReportForm(request.POST, lecturer=lecturer)
        if form.is_valid():
            report = form.save(commit=False)
            report.generated_by = lecturer
            # Implement calculate_statistics on AttendanceReport model
            try:
                report.calculate_statistics()
            except Exception:
                logger.exception("Error calculating report statistics")
            report.is_generated = True
            report.save()

            log_system_action(request.user, SystemLog.ActionType.REPORT,
                            f"Attendance report generated: {report.title}")
            messages.success(request, 'Report generated successfully!')
            return HttpResponseRedirect(reverse('lecturer_attendance') + '?tab=reports')
    else:
        form = AttendanceReportForm(lecturer=lecturer)

    context = {
        'form': form,
        'lecturer': lecturer
    }
    return render(request, 'lecturer/attendance.html', context)


# ---------------------------
# Student Views
# ---------------------------

@student_required
def student_dashboard(request):
    # Safely access student_profile
    if not hasattr(request.user, 'student_profile'):
        logger.error("student_dashboard: user=%s missing student_profile", request.user.username)
        # redirect to a safe place or show message
        messages.error(request, "Student profile not found. Contact admin.")
        return redirect('login')

    student = request.user.student_profile
    today = timezone.now().date()

    # Student's statistics
    enrolled_units = StudentUnitEnrollment.objects.filter(student=student, is_active=True).count()

    # Today's classes
    todays_classes = ClassSchedule.objects.filter(
        semester_unit__enrolled_students__student=student,
        schedule_date=today,
        is_active=True
    ).distinct().select_related('semester_unit__unit')

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

    context = {
        'student': student,
        'enrolled_units': enrolled_units,
        'todays_classes': todays_classes,
        'upcoming_classes': upcoming_classes,
        'recent_attendance': recent_attendance,
    }
    return render(request, 'student/dashboard.html', context)


@student_required
def student_portal(request):
    """Combined portal for classes, units, and attendance"""
    if not hasattr(request.user, 'student_profile'):
        logger.error("student_portal: user=%s missing student_profile", request.user.username)
        messages.error(request, "Student profile not found. Contact admin.")
        return redirect('login')

    student = request.user.student_profile
    active_tab = request.GET.get('tab', 'classes')  # Default to classes tab

    # Get today's date
    today = timezone.now().date()

    # Get all data for the combined portal
    unit_enrollments = StudentUnitEnrollment.objects.filter(
        student=student, is_active=True
    ).select_related('semester_unit__unit', 'semester_unit__semester', 'semester_unit__lecturer__user')

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
    attendance_percentage = (present_classes / total_classes * 100) if total_classes > 0 else 0

    # Get today's classes for QR scanning
    todays_classes = ClassSchedule.objects.filter(
        semester_unit__enrolled_students__student=student,
        schedule_date=today,
        is_active=True
    ).distinct()

    # Get upcoming classes (next 7 days)
    upcoming_start = today + timedelta(days=1)
    upcoming_end = today + timedelta(days=7)
    upcoming_classes = ClassSchedule.objects.filter(
        semester_unit__enrolled_students__student=student,
        schedule_date__range=[upcoming_start, upcoming_end],
        is_active=True
    ).distinct().order_by('schedule_date', 'start_time')

    # Initialize context with all required variables
    context = {
        'student': student,
        'unit_enrollments': unit_enrollments,
        'classes': classes,
        'attendances': attendances,
        'todays_classes': todays_classes,
        'upcoming_classes': upcoming_classes,
        'total_classes': total_classes,
        'present_classes': present_classes,
        'attendance_percentage': round(attendance_percentage, 2),
        'active_tab': active_tab,
        'today': today,
        'enrolled_units': unit_enrollments.count(),
    }

    # Get unit-specific attendance if unit_id provided
    unit_id = request.GET.get('unit_id')
    if unit_id:
        try:
            unit_attendance_data = get_object_or_404(SemesterUnit, id=unit_id)
            # Verify student is enrolled in this unit
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
            else:
                logger.debug("student_portal: student %s not enrolled in unit %s", student, unit_id)
        except Exception:
            logger.exception("Error loading unit attendance for unit_id=%s", unit_id)

    return render(request, 'student/student.html', context)


@student_required
@csrf_exempt  # Keep this if mobile clients post without CSRF token; consider token auth for production
def scan_qr_code(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Invalid request method'}, status=405)

    try:
        data = json.loads(request.body)
    except ValueError:
        return JsonResponse({'success': False, 'message': 'Invalid JSON payload'}, status=400)

    try:
        qr_token = data.get('token')
        latitude = data.get('latitude')
        longitude = data.get('longitude')

        if not qr_token:
            return JsonResponse({'success': False, 'message': 'Missing token'}, status=400)

        # Validate QR code
        qr_code = get_object_or_404(QRCode, token=qr_token, is_active=True)

        if getattr(qr_code, 'is_expired', False):
            return JsonResponse({'success': False, 'message': 'QR code has expired'}, status=400)

        class_schedule = qr_code.class_schedule

        # Check if class is ongoing
        if not getattr(class_schedule, 'is_ongoing', False):
            return JsonResponse({'success': False, 'message': 'Class is not ongoing'}, status=400)

        # Validate location
        try:
            location_valid = validate_location(
                float(latitude),
                float(longitude),
                float(class_schedule.latitude),
                float(class_schedule.longitude),
                class_schedule.location_radius
            )
        except Exception:
            logger.exception("scan_qr_code: invalid location data")
            return JsonResponse({'success': False, 'message': 'Invalid location data'}, status=400)

        # Safely get student profile
        if not hasattr(request.user, 'student_profile'):
            return JsonResponse({'success': False, 'message': 'Student profile not found'}, status=403)

        student = request.user.student_profile

        # Check if student is enrolled in this unit
        if not StudentUnitEnrollment.objects.filter(
            student=student,
            semester_unit=class_schedule.semester_unit
        ).exists():
            return JsonResponse({'success': False, 'message': 'You are not enrolled in this unit'}, status=403)

        # Create or update attendance (atomicity recommended in production)
        attendance, created = Attendance.objects.get_or_create(
            student=student,
            class_schedule=class_schedule,
            defaults={
                'qr_code': qr_code,
                'status': Attendance.AttendanceStatus.PRESENT,
                'scan_time': timezone.now(),
                'scan_latitude': latitude,
                'scan_longitude': longitude,
                'location_valid': location_valid,
            }
        )

        if not created:
            attendance.qr_code = qr_code
            attendance.status = Attendance.AttendanceStatus.PRESENT
            attendance.scan_time = timezone.now()
            attendance.scan_latitude = latitude
            attendance.scan_longitude = longitude
            attendance.location_valid = location_valid
            attendance.save()

        log_system_action(request.user, SystemLog.ActionType.SCAN,
                        f"QR code scanned for class: {class_schedule.semester_unit.unit.name}")

        return JsonResponse({
            'success': True,
            'message': 'Attendance marked successfully!',
            'location_valid': location_valid
        })

    except Http404:
        return JsonResponse({'success': False, 'message': 'QR code not found'}, status=404)
    except Exception:
        logger.exception("Error processing QR scan")
        return JsonResponse({'success': False, 'message': 'Failed to process scan'}, status=500)


# ---------------------------
# API Views (simple JSON)
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
    if not getattr(request.user, 'is_admin', False) and not (getattr(request.user, 'is_lecturer', False) and has_access_to_student(request.user.lecturer_profile, student_id)):
        return JsonResponse({'error': 'Permission denied'}, status=403)

    student = get_object_or_404(StudentProfile, id=student_id)
    attendances = Attendance.objects.filter(student=student).values(
        'class_schedule__semester_unit__unit__name',
        'class_schedule__schedule_date',
        'status',
        'scan_time'
    ).order_by('-class_schedule__schedule_date')

    return JsonResponse(list(attendances), safe=False)


@api_required
def api_class_attendance(request, class_id):
    """API endpoint to get class attendance data"""
    class_schedule = get_object_or_404(ClassSchedule, id=class_id)

    if not getattr(request.user, 'is_admin', False) and not (getattr(request.user, 'is_lecturer', False) and class_schedule.lecturer.user == request.user):
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


# ---------------------------
# Utility functions
# ---------------------------

def validate_location(user_lat, user_lng, class_lat, class_lng, radius_meters):
    """Validate if user location is within allowed radius of class location (meters)."""
    from math import radians, sin, cos, sqrt, atan2

    # Convert degrees to radians
    lat1 = radians(user_lat)
    lon1 = radians(user_lng)
    lat2 = radians(class_lat)
    lon2 = radians(class_lng)

    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    distance = 6371000 * c  # Earth radius in meters

    return distance <= radius_meters


def has_access_to_student(lecturer, student_id):
    """Check if lecturer has access to student's data"""
    student = get_object_or_404(StudentProfile, id=student_id)
    return StudentUnitEnrollment.objects.filter(
        student=student,
        semester_unit__lecturer=lecturer
    ).exists()


# ---------------------------
# Error handlers
# ---------------------------

def handler403(request, exception):
    return render(request, 'errors/403.html', status=403)

def handler404(request, exception):
    return render(request, 'errors/404.html', status=404)

def handler500(request):
    return render(request, 'errors/500.html', status=500)
