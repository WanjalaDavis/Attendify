from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from django.utils.html import format_html
from django.utils import timezone
from django.db.models import Count, Q
from django.http import HttpResponse
from django.contrib import messages
from django.urls import reverse
from django.core.exceptions import ValidationError
import csv
import json
from datetime import datetime, timedelta
import secrets

from .models import *

# Custom User Creation Form for Admin
class CustomUserCreationForm(UserCreationForm):
    class Meta:
        model = User
        fields = ('username', 'email', 'user_type', 'first_name', 'last_name', 'password1', 'password2')
    
    def save(self, commit=True):
        user = super().save(commit=False)
        if commit:
            user.save()
            # Create corresponding profile based on user_type
            if user.is_student and not hasattr(user, 'student_profile'):
                # Generate unique registration number for student
                registration_number = f"STU{secrets.token_hex(6).upper()}"
                StudentProfile.objects.create(
                    user=user, 
                    registration_number=registration_number
                )
            elif user.is_lecturer and not hasattr(user, 'lecturer_profile'):
                LecturerProfile.objects.create(user=user)
            elif user.is_admin and not hasattr(user, 'admin_profile'):
                SystemAdminProfile.objects.create(user=user)
        return user


# Custom User Change Form for Admin
class CustomUserChangeForm(UserChangeForm):
    class Meta:
        model = User
        fields = '__all__'


# Inline for Student Profile
class StudentProfileInline(admin.StackedInline):
    model = StudentProfile
    can_delete = False
    verbose_name_plural = 'Student Profile'
    fields = ('registration_number', 'year_of_study', 'is_active', 'enrollment_date')
    readonly_fields = ('created_at', 'updated_at', 'enrollment_date')
    extra = 0


# Inline for Lecturer Profile
class LecturerProfileInline(admin.StackedInline):
    model = LecturerProfile
    can_delete = False
    verbose_name_plural = 'Lecturer Profile'
    fields = ('employee_id', 'specialization', 'qualifications', 'is_active')
    readonly_fields = ('date_joined', 'created_at', 'updated_at')
    extra = 0


# Inline for Admin Profile
class SystemAdminProfileInline(admin.StackedInline):
    model = SystemAdminProfile
    can_delete = False
    verbose_name_plural = 'Admin Profile'
    fields = ('admin_id', 'department')
    readonly_fields = ('created_at', 'updated_at')
    extra = 0


# Custom User Admin with Profile Inlines
class CustomUserAdmin(UserAdmin):
    add_form = CustomUserCreationForm
    form = CustomUserChangeForm
    
    list_display = ('username', 'email', 'get_user_type', 'full_name', 'is_active', 'last_login', 'date_joined')
    list_filter = ('user_type', 'is_active', 'is_staff', 'is_superuser', 'date_joined')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    readonly_fields = ('date_joined', 'last_login', 'created_at', 'updated_at')
    actions = ['activate_users', 'deactivate_users', 'export_users_csv']
    
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Personal Info', {'fields': ('first_name', 'last_name', 'email', 'phone_number', 'date_of_birth', 'age')}),
        ('Profile', {'fields': ('profile_picture', 'user_type')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'is_verified', 'groups', 'user_permissions')}),
        ('Important Dates', {'fields': ('last_login', 'date_joined', 'created_at', 'updated_at')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'email', 'user_type', 'first_name', 'last_name', 'password1', 'password2', 'is_staff', 'is_active')}
        ),
    )
    
    ordering = ('-date_joined',)
    
    def get_inlines(self, request, obj=None):
        """Show appropriate inline based on user type"""
        if obj:
            if obj.is_student:
                return [StudentProfileInline]
            elif obj.is_lecturer:
                return [LecturerProfileInline]
            elif obj.is_admin:
                return [SystemAdminProfileInline]
        return []
    
    def get_user_type(self, obj):
        return obj.get_user_type_display()
    get_user_type.short_description = 'User Type'
    
    def full_name(self, obj):
        return obj.get_full_name()
    full_name.short_description = 'Full Name'
    
    def save_model(self, request, obj, form, change):
        """Auto-create profile when user is created with proper registration numbers"""
        super().save_model(request, obj, form, change)
    
        if not change:  # Only for new users
            if obj.is_student and not hasattr(obj, 'student_profile'):
                # Generate unique registration number for student
                registration_number = f"STU{secrets.token_hex(6).upper()}"
                StudentProfile.objects.create(
                    user=obj,
                    registration_number=registration_number
                )
            elif obj.is_lecturer and not hasattr(obj, 'lecturer_profile'):
                LecturerProfile.objects.create(user=obj)
            elif obj.is_admin and not hasattr(obj, 'admin_profile'):
                SystemAdminProfile.objects.create(user=obj)
    
    @admin.action(description='Activate selected users')
    def activate_users(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} users activated successfully.', messages.SUCCESS)
    
    @admin.action(description='Deactivate selected users')
    def deactivate_users(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} users deactivated successfully.', messages.SUCCESS)
    
    @admin.action(description='Export selected users to CSV')
    def export_users_csv(self, request, queryset):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="users_export.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'Username', 'Email', 'Full Name', 'User Type', 'Phone Number', 
            'Is Active', 'Date Joined', 'Last Login'
        ])
        
        for user in queryset:
            writer.writerow([
                user.username,
                user.email,
                user.get_full_name(),
                user.get_user_type_display(),
                user.phone_number,
                'Yes' if user.is_active else 'No',
                user.date_joined.strftime('%Y-%m-%d %H:%M'),
                user.last_login.strftime('%Y-%m-%d %H:%M') if user.last_login else 'Never'
            ])
        
        return response


# Quick Action Admin Mixin for Easy User Creation
class QuickUserCreationMixin:
    """Mixin to add quick user creation actions"""
    
    @admin.action(description='Create user account for selected profiles')
    def create_user_accounts(self, request, queryset):
        created_count = 0
        for profile in queryset:
            if not hasattr(profile, 'user'):
                # Create a new user
                username = getattr(profile, 'registration_number', None) or getattr(profile, 'employee_id', None)
                if not username:
                    username = f"{profile.__class__.__name__.lower()}_{profile.id}"
                
                email = f"{username}@attendify.edu"
                
                user_type = 'STUDENT' if isinstance(profile, StudentProfile) else 'LECTURER'
                
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password='default123',  # Temporary password
                    user_type=user_type
                )
                
                # Update the profile to link with user
                profile.user = user
                profile.save()
                created_count += 1
        
        if created_count > 0:
            self.message_user(
                request, 
                f'Successfully created user accounts for {created_count} profiles. Default password: default123', 
                messages.SUCCESS
            )
        else:
            self.message_user(request, 'All selected profiles already have user accounts.', messages.WARNING)


# Enhanced Student Profile Admin
class StudentProfileAdmin(admin.ModelAdmin, QuickUserCreationMixin):
    list_display = ('registration_number', 'user_link', 'year_of_study', 'enrollment_date', 'is_active', 'attendance_rate', 'enrollments_count')
    list_filter = ('year_of_study', 'is_active', 'enrollment_date', 'created_at')
    search_fields = ('registration_number', 'user__username', 'user__first_name', 'user__last_name')
    readonly_fields = ('created_at', 'updated_at', 'attendance_rate', 'enrollment_date', 'enrollments_count', 'registration_number')
    actions = ['activate_students', 'deactivate_students', 'create_user_accounts', 'generate_registration_numbers']
    
    fieldsets = (
        (None, {'fields': ('user', 'registration_number')}),
        ('Academic Info', {'fields': ('year_of_study',)}),
        ('Status', {'fields': ('is_active',)}),
        ('Statistics', {'fields': ('attendance_rate', 'enrollments_count')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at', 'enrollment_date')}),
    )
    
    def attendance_rate(self, obj):
        total_attendances = Attendance.objects.filter(student=obj).count()
        present_attendances = Attendance.objects.filter(
            student=obj, 
            status__in=['PRESENT', 'LATE']
        ).count()
        if total_attendances > 0:
            rate = (present_attendances / total_attendances) * 100
            return f"{rate:.1f}%"
        return "N/A"
    attendance_rate.short_description = 'Overall Attendance Rate'
    
    def enrollments_count(self, obj):
        return obj.enrollments.count()
    enrollments_count.short_description = 'Course Enrollments'
    
    def user_link(self, obj):
        if obj.user:
            url = reverse('admin:attendify_user_change', args=[obj.user.id])
            return format_html('<a href="{}">{}</a>', url, obj.user.username)
        return "No User Account"
    user_link.short_description = 'User Account'
    user_link.admin_order_field = 'user__username'
    
    def save_model(self, request, obj, form, change):
        """Ensure registration_number is set before saving"""
        if not obj.registration_number:
            obj.registration_number = f"STU{secrets.token_hex(6).upper()}"
        super().save_model(request, obj, form, change)
    
    @admin.action(description='Activate selected students')
    def activate_students(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} students activated successfully.', messages.SUCCESS)
    
    @admin.action(description='Deactivate selected students')
    def deactivate_students(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} students deactivated successfully.', messages.SUCCESS)
    
    @admin.action(description='Generate registration numbers for selected')
    def generate_registration_numbers(self, request, queryset):
        updated_count = 0
        for student in queryset:
            if not student.registration_number:
                student.registration_number = f"STU{secrets.token_hex(6).upper()}"
                student.save()
                updated_count += 1
        self.message_user(request, f'Generated registration numbers for {updated_count} students.', messages.SUCCESS)


# Enhanced Lecturer Profile Admin
class LecturerProfileAdmin(admin.ModelAdmin, QuickUserCreationMixin):
    list_display = ('employee_id', 'user_link', 'specialization', 'date_joined', 'is_active', 'teaching_units_count', 'scheduled_classes_count')
    list_filter = ('is_active', 'date_joined', 'specialization', 'created_at')
    search_fields = ('employee_id', 'user__username', 'user__first_name', 'user__last_name', 'specialization')
    readonly_fields = ('employee_id', 'created_at', 'updated_at', 'teaching_units_count', 'scheduled_classes_count', 'date_joined')
    actions = ['activate_lecturers', 'deactivate_lecturers', 'create_user_accounts']
    
    fieldsets = (
        (None, {'fields': ('user', 'employee_id')}),
        ('Professional Info', {'fields': ('specialization', 'qualifications')}),
        ('Status', {'fields': ('is_active',)}),
        ('Statistics', {'fields': ('teaching_units_count', 'scheduled_classes_count')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at', 'date_joined')}),
    )
    
    def teaching_units_count(self, obj):
        return obj.teaching_units.count()
    teaching_units_count.short_description = 'Teaching Units'
    
    def scheduled_classes_count(self, obj):
        return obj.scheduled_classes.count()
    scheduled_classes_count.short_description = 'Scheduled Classes'
    
    def user_link(self, obj):
        if obj.user:
            url = reverse('admin:attendify_user_change', args=[obj.user.id])
            return format_html('<a href="{}">{}</a>', url, obj.user.username)
        return "No User Account"
    user_link.short_description = 'User Account'
    user_link.admin_order_field = 'user__username'
    
    @admin.action(description='Activate selected lecturers')
    def activate_lecturers(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} lecturers activated successfully.', messages.SUCCESS)
    
    @admin.action(description='Deactivate selected lecturers')
    def deactivate_lecturers(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} lecturers deactivated successfully.', messages.WARNING)


# System Admin Profile Admin
class SystemAdminProfileAdmin(admin.ModelAdmin):
    list_display = ('admin_id', 'user_link', 'department', 'created_at')
    search_fields = ('admin_id', 'user__username', 'department')
    readonly_fields = ('admin_id', 'created_at', 'updated_at')
    list_filter = ('department', 'created_at')
    
    def user_link(self, obj):
        if obj.user:
            url = reverse('admin:attendify_user_change', args=[obj.user.id])
            return format_html('<a href="{}">{}</a>', url, obj.user.username)
        return "No User Account"
    user_link.short_description = 'User Account'


# Department Admin
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'courses_count', 'units_count', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('code', 'name', 'description')
    readonly_fields = ('created_at', 'updated_at', 'courses_count', 'units_count')
    list_editable = ('is_active',)
    actions = ['activate_departments', 'deactivate_departments']
    
    def courses_count(self, obj):
        return obj.courses.count()
    courses_count.short_description = 'Number of Courses'
    
    def units_count(self, obj):
        return obj.units.count()
    units_count.short_description = 'Number of Units'
    
    @admin.action(description='Activate selected departments')
    def activate_departments(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} departments activated successfully.', messages.SUCCESS)
    
    @admin.action(description='Deactivate selected departments')
    def deactivate_departments(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} departments deactivated successfully.', messages.WARNING)


# Course Admin
class CourseAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'department', 'course_type', 'duration_years', 'semesters_count', 'enrollments_count', 'is_active')
    list_filter = ('course_type', 'department', 'is_active', 'duration_years', 'created_at')
    search_fields = ('code', 'name', 'description')
    readonly_fields = ('created_at', 'updated_at', 'semesters_count', 'enrollments_count')
    list_editable = ('is_active',)
    actions = ['activate_courses', 'deactivate_courses']
    
    def semesters_count(self, obj):
        return obj.semesters.count()
    semesters_count.short_description = 'Number of Semesters'
    
    def enrollments_count(self, obj):
        return obj.enrollments.count()
    enrollments_count.short_description = 'Student Enrollments'
    
    @admin.action(description='Activate selected courses')
    def activate_courses(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} courses activated successfully.', messages.SUCCESS)
    
    @admin.action(description='Deactivate selected courses')
    def deactivate_courses(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} courses deactivated successfully.', messages.WARNING)


# Semester Admin
class SemesterAdmin(admin.ModelAdmin):
    list_display = ('name', 'course', 'semester_number', 'start_date', 'end_date', 'is_current', 'semester_units_count')
    list_filter = ('course', 'is_current', 'start_date', 'course__department')
    search_fields = ('name', 'course__code', 'course__name')
    readonly_fields = ('created_at', 'updated_at', 'semester_units_count')
    list_editable = ('is_current',)
    actions = ['mark_as_current', 'mark_as_not_current']
    
    def semester_units_count(self, obj):
        return obj.semester_units.count()
    semester_units_count.short_description = 'Units in Semester'
    
    def save_model(self, request, obj, form, change):
        if obj.is_current:
            Semester.objects.filter(course=obj.course, is_current=True).update(is_current=False)
        super().save_model(request, obj, form, change)
    
    @admin.action(description='Mark selected as current semester')
    def mark_as_current(self, request, queryset):
        for semester in queryset:
            Semester.objects.filter(course=semester.course, is_current=True).update(is_current=False)
            semester.is_current = True
            semester.save()
        self.message_user(request, f'{queryset.count()} semesters marked as current.', messages.SUCCESS)
    
    @admin.action(description='Mark selected as not current')
    def mark_as_not_current(self, request, queryset):
        updated = queryset.update(is_current=False)
        self.message_user(request, f'{updated} semesters marked as not current.', messages.SUCCESS)


# Unit Admin
class UnitAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'department', 'credit_hours', 'is_core', 'semester_units_count', 'is_active')
    list_filter = ('department', 'is_core', 'is_active', 'credit_hours', 'created_at')
    search_fields = ('code', 'name', 'description')
    readonly_fields = ('created_at', 'updated_at', 'semester_units_count')
    list_editable = ('is_active', 'is_core')
    actions = ['activate_units', 'deactivate_units', 'mark_as_core', 'mark_as_elective']
    
    def semester_units_count(self, obj):
        return obj.semester_units.count()
    semester_units_count.short_description = 'Times Offered'
    
    @admin.action(description='Activate selected units')
    def activate_units(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} units activated successfully.', messages.SUCCESS)
    
    @admin.action(description='Deactivate selected units')
    def deactivate_units(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} units deactivated successfully.', messages.WARNING)
    
    @admin.action(description='Mark selected as core units')
    def mark_as_core(self, request, queryset):
        updated = queryset.update(is_core=True)
        self.message_user(request, f'{updated} units marked as core.', messages.SUCCESS)
    
    @admin.action(description='Mark selected as elective units')
    def mark_as_elective(self, request, queryset):
        updated = queryset.update(is_core=False)
        self.message_user(request, f'{updated} units marked as elective.', messages.SUCCESS)


# Enrollment Admin
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ('get_student_info', 'course', 'enrollment_date', 'expected_graduation', 'is_active')
    list_filter = ('course', 'is_active', 'enrollment_date', 'course__department')
    search_fields = ('student__registration_number', 'student__user__username', 'student__user__first_name', 'student__user__last_name', 'course__code', 'course__name')
    readonly_fields = ('created_at', 'enrollment_date')
    list_editable = ('is_active',)
    autocomplete_fields = ('student', 'course')
    actions = ['activate_enrollments', 'deactivate_enrollments']
    
    def get_student_info(self, obj):
        """Display meaningful student information in list view"""
        if obj.student and obj.student.user:
            return f"{obj.student.registration_number} - {obj.student.user.get_full_name() or obj.student.user.username}"
        return "No Student Info"
    get_student_info.short_description = 'Student'
    get_student_info.admin_order_field = 'student__registration_number'
    
    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        """Customize the student dropdown to show better information"""
        if db_field.name == "student":
            kwargs["queryset"] = StudentProfile.objects.filter(is_active=True).select_related('user')
        return super().formfield_for_foreignkey(db_field, request, **kwargs)
    
    @admin.action(description='Activate selected enrollments')
    def activate_enrollments(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} enrollments activated successfully.', messages.SUCCESS)
    
    @admin.action(description='Deactivate selected enrollments')
    def deactivate_enrollments(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} enrollments deactivated successfully.', messages.WARNING)


# Semester Unit Admin
class SemesterUnitAdmin(admin.ModelAdmin):
    list_display = ('unit', 'semester', 'lecturer', 'max_students', 'current_students', 'enrollment_count', 'class_schedules_count')
    list_filter = ('semester', 'lecturer', 'semester__course')
    search_fields = ('unit__code', 'unit__name', 'semester__name', 'lecturer__user__username')
    readonly_fields = ('created_at', 'updated_at', 'current_students', 'enrollment_count', 'class_schedules_count')
    autocomplete_fields = ('lecturer', 'unit', 'semester')
    actions = ['update_student_counts']
    
    def enrollment_count(self, obj):
        return obj.enrolled_students.count()
    enrollment_count.short_description = 'Enrolled Students'
    
    def class_schedules_count(self, obj):
        return obj.class_schedules.count()
    class_schedules_count.short_description = 'Scheduled Classes'
    
    @admin.action(description='Update student counts for selected')
    def update_student_counts(self, request, queryset):
        for semester_unit in queryset:
            semester_unit.update_student_count()
        self.message_user(request, f'Student counts updated for {queryset.count()} semester units.', messages.SUCCESS)


# Student Unit Enrollment Admin
class StudentUnitEnrollmentAdmin(admin.ModelAdmin):
    list_display = ('student', 'semester_unit', 'enrollment_date', 'is_active')
    list_filter = ('semester_unit__semester', 'is_active', 'enrollment_date')
    search_fields = ('student__registration_number', 'semester_unit__unit__code', 'student__user__username')
    readonly_fields = ('enrollment_date',)
    list_editable = ('is_active',)
    autocomplete_fields = ('student', 'semester_unit')
    actions = ['activate_enrollments', 'deactivate_enrollments']
    
    @admin.action(description='Activate selected unit enrollments')
    def activate_enrollments(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} unit enrollments activated successfully.', messages.SUCCESS)
    
    @admin.action(description='Deactivate selected unit enrollments')
    def deactivate_enrollments(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} unit enrollments deactivated successfully.', messages.WARNING)


# Class Schedule Admin
class ClassScheduleAdmin(admin.ModelAdmin):
    list_display = ('semester_unit', 'schedule_date', 'start_time', 'end_time', 'venue', 'lecturer', 'is_active', 'attendance_count', 'is_ongoing_display')
    list_filter = ('schedule_date', 'lecturer', 'is_active', 'semester_unit__semester')
    search_fields = ('venue', 'semester_unit__unit__code', 'lecturer__user__username')
    readonly_fields = ('created_at', 'updated_at', 'attendance_count', 'is_ongoing_display')
    list_editable = ('is_active',)
    date_hierarchy = 'schedule_date'
    actions = ['activate_schedules', 'deactivate_schedules', 'generate_qr_codes']
    
    def attendance_count(self, obj):
        return obj.attendances.count()
    attendance_count.short_description = 'Attendance Records'
    
    def is_ongoing_display(self, obj):
        return obj.is_ongoing
    is_ongoing_display.boolean = True
    is_ongoing_display.short_description = 'Is Ongoing'
    
    @admin.action(description='Activate selected schedules')
    def activate_schedules(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} class schedules activated successfully.', messages.SUCCESS)
    
    @admin.action(description='Deactivate selected schedules')
    def deactivate_schedules(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} class schedules deactivated successfully.', messages.WARNING)
    
    @admin.action(description='Generate QR codes for selected schedules')
    def generate_qr_codes(self, request, queryset):
        created_count = 0
        for schedule in queryset:
            if not hasattr(schedule, 'qr_code'):
                QRCode.objects.create(
                    class_schedule=schedule,
                    expires_at=timezone.now() + timedelta(hours=2)
                )
                created_count += 1
        self.message_user(request, f'{created_count} QR codes generated successfully.', messages.SUCCESS)


# QR Code Admin
class QRCodeAdmin(admin.ModelAdmin):
    list_display = (
        'class_schedule',
        'token_short',
        'generated_at',
        'expires_at',
        'is_active',
        'is_expired_display',
        'attendance_count'
    )
    list_filter = ('is_active', 'generated_at')
    search_fields = ('token', 'class_schedule__semester_unit__unit__code')
    readonly_fields = ('token', 'generated_at', 'expires_at', 'is_expired_display', 'qr_code_preview', 'attendance_count')
    exclude = ('qr_code_image',)
    actions = ['activate_qr_codes', 'deactivate_qr_codes', 'regenerate_tokens']

    def token_short(self, obj):
        return obj.token[:20] + '...' if len(obj.token) > 20 else obj.token
    token_short.short_description = 'Token'

    def is_expired_display(self, obj):
        return obj.is_expired
    is_expired_display.boolean = True
    is_expired_display.short_description = 'Expired?'

    def attendance_count(self, obj):
        return obj.attendances.count()
    attendance_count.short_description = 'Attendance Records'

    def qr_code_preview(self, obj):
        if obj.qr_code_image:
            return format_html('<img src="{}" width="200" height="200" />', obj.qr_code_image.url)
        return "No QR Code Generated"
    qr_code_preview.short_description = 'QR Code Preview'
    
    @admin.action(description='Activate selected QR codes')
    def activate_qr_codes(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} QR codes activated successfully.', messages.SUCCESS)
    
    @admin.action(description='Deactivate selected QR codes')
    def deactivate_qr_codes(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} QR codes deactivated successfully.', messages.WARNING)
    
    @admin.action(description='Regenerate tokens for selected QR codes')
    def regenerate_tokens(self, request, queryset):
        import secrets
        for qr_code in queryset:
            qr_code.token = secrets.token_urlsafe(32)
            qr_code.save()
        self.message_user(request, f'{queryset.count()} QR code tokens regenerated.', messages.SUCCESS)


# Attendance Admin
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ('student', 'class_schedule', 'status', 'scan_time', 'location_valid', 'marked_by_lecturer', 'was_late_display')
    list_filter = ('status', 'location_valid', 'marked_by_lecturer', 'class_schedule__schedule_date')
    search_fields = ('student__registration_number', 'class_schedule__semester_unit__unit__code')
    readonly_fields = ('created_at', 'updated_at', 'was_late_display')
    list_editable = ('status',)
    actions = ['export_attendance_csv', 'mark_as_present', 'mark_as_absent', 'mark_as_late', 'validate_locations']
    
    def was_late_display(self, obj):
        return obj.was_late
    was_late_display.boolean = True
    was_late_display.short_description = 'Was Late'
    
    @admin.action(description='Export selected attendance records to CSV')
    def export_attendance_csv(self, request, queryset):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="attendance_export.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'Student ID', 'Student Name', 'Unit Code', 'Unit Name', 
            'Class Date', 'Status', 'Scan Time', 'Location Valid', 'Was Late'
        ])
        
        for attendance in queryset:
            writer.writerow([
                attendance.student.registration_number,
                attendance.student.user.get_full_name(),
                attendance.class_schedule.semester_unit.unit.code,
                attendance.class_schedule.semester_unit.unit.name,
                attendance.class_schedule.schedule_date,
                attendance.get_status_display(),
                attendance.scan_time.strftime('%Y-%m-%d %H:%M') if attendance.scan_time else 'N/A',
                'Yes' if attendance.location_valid else 'No',
                'Yes' if attendance.was_late else 'No'
            ])
        
        return response
    
    @admin.action(description='Mark selected as present')
    def mark_as_present(self, request, queryset):
        updated = queryset.update(status='PRESENT', marked_by_lecturer=True)
        self.message_user(request, f'{updated} attendance records marked as present.', messages.SUCCESS)
    
    @admin.action(description='Mark selected as absent')
    def mark_as_absent(self, request, queryset):
        updated = queryset.update(status='ABSENT', marked_by_lecturer=True)
        self.message_user(request, f'{updated} attendance records marked as absent.', messages.SUCCESS)
    
    @admin.action(description='Mark selected as late')
    def mark_as_late(self, request, queryset):
        updated = queryset.update(status='LATE', marked_by_lecturer=True)
        self.message_user(request, f'{updated} attendance records marked as late.', messages.SUCCESS)
    
    @admin.action(description='Validate locations for selected')
    def validate_locations(self, request, queryset):
        # This is a simplified location validation - implement your actual logic here
        updated = queryset.update(location_valid=True)
        self.message_user(request, f'{updated} attendance locations validated.', messages.SUCCESS)


# System Log Admin
class SystemLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'action_type', 'log_level', 'timestamp', 'ip_address_short')
    list_filter = ('action_type', 'log_level', 'timestamp')
    search_fields = ('user__username', 'description', 'ip_address')
    readonly_fields = ('timestamp', 'user', 'action_type', 'log_level', 'description', 'ip_address', 'user_agent', 'metadata_preview')
    date_hierarchy = 'timestamp'
    actions = ['export_logs_csv', 'cleanup_old_logs']
    
    def ip_address_short(self, obj):
        return obj.ip_address if obj.ip_address else 'N/A'
    ip_address_short.short_description = 'IP Address'
    
    def metadata_preview(self, obj):
        if obj.metadata:
            return format_html('<pre>{}</pre>', json.dumps(obj.metadata, indent=2))
        return 'No metadata'
    metadata_preview.short_description = 'Metadata'
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False
    
    @admin.action(description='Export selected logs to CSV')
    def export_logs_csv(self, request, queryset):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="system_logs_export.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'Timestamp', 'User', 'Action Type', 'Log Level', 'Description', 
            'IP Address', 'User Agent'
        ])
        
        for log in queryset:
            writer.writerow([
                log.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                log.user.username if log.user else 'System',
                log.get_action_type_display(),
                log.get_log_level_display(),
                log.description[:100] + '...' if len(log.description) > 100 else log.description,
                log.ip_address or 'N/A',
                log.user_agent[:100] + '...' if log.user_agent and len(log.user_agent) > 100 else log.user_agent or 'N/A'
            ])
        
        return response
    
    @admin.action(description='Clean up logs older than 30 days')
    def cleanup_old_logs(self, request, queryset):
        from django.utils import timezone
        cutoff_date = timezone.now() - timedelta(days=30)
        old_logs = SystemLog.objects.filter(timestamp__lt=cutoff_date)
        count = old_logs.count()
        old_logs.delete()
        self.message_user(request, f'{count} logs older than 30 days deleted.', messages.SUCCESS)


# Attendance Report Admin
class AttendanceReportAdmin(admin.ModelAdmin):
    list_display = ('title', 'generated_by', 'semester_unit', 'report_type', 'start_date', 'end_date', 'average_attendance', 'is_generated', 'generated_at')
    list_filter = ('report_type', 'is_generated', 'generated_at', 'report_format')
    search_fields = ('title', 'generated_by__user__username', 'semester_unit__unit__code')
    readonly_fields = ('generated_at', 'total_classes', 'total_students', 'average_attendance', 'is_generated')
    actions = ['generate_reports', 'export_reports_data']
    
    @admin.action(description='Generate selected reports')
    def generate_reports(self, request, queryset):
        for report in queryset:
            report.calculate_statistics()
            report.is_generated = True
            report.save()
        self.message_user(request, f'{queryset.count()} reports generated successfully.', messages.SUCCESS)
    
    @admin.action(description='Export reports data to JSON')
    def export_reports_data(self, request, queryset):
        reports_data = []
        for report in queryset:
            reports_data.append({
                'title': report.title,
                'generated_by': report.generated_by.user.username,
                'semester_unit': str(report.semester_unit),
                'report_type': report.get_report_type_display(),
                'start_date': report.start_date.isoformat(),
                'end_date': report.end_date.isoformat(),
                'total_classes': report.total_classes,
                'total_students': report.total_students,
                'average_attendance': float(report.average_attendance),
                'generated_at': report.generated_at.isoformat()
            })
        
        response = HttpResponse(json.dumps(reports_data, indent=2), content_type='application/json')
        response['Content-Disposition'] = 'attachment; filename="reports_export.json"'
        return response


# Student Attendance Summary Admin
class StudentAttendanceSummaryAdmin(admin.ModelAdmin):
    list_display = ('student', 'semester_unit', 'total_classes', 'classes_attended', 'attendance_percentage', 'last_updated')
    list_filter = ('semester_unit__semester', 'last_updated')
    search_fields = ('student__registration_number', 'semester_unit__unit__code')
    readonly_fields = ('total_classes', 'classes_attended', 'classes_absent', 'classes_late', 'attendance_percentage', 'last_updated')
    actions = ['recalculate_summaries', 'export_summaries_csv']
    
    @admin.action(description='Recalculate selected summaries')
    def recalculate_summaries(self, request, queryset):
        for summary in queryset:
            summary.calculate_summary()
        self.message_user(request, f'{queryset.count()} attendance summaries recalculated.', messages.SUCCESS)
    
    @admin.action(description='Export summaries to CSV')
    def export_summaries_csv(self, request, queryset):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="attendance_summaries.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'Student ID', 'Student Name', 'Unit Code', 'Unit Name',
            'Total Classes', 'Classes Attended', 'Classes Absent', 
            'Classes Late', 'Attendance Percentage', 'Last Updated'
        ])
        
        for summary in queryset:
            writer.writerow([
                summary.student.registration_number,
                summary.student.user.get_full_name(),
                summary.semester_unit.unit.code,
                summary.semester_unit.unit.name,
                summary.total_classes,
                summary.classes_attended,
                summary.classes_absent,
                summary.classes_late,
                f"{summary.attendance_percentage}%",
                summary.last_updated.strftime('%Y-%m-%d %H:%M')
            ])
        
        return response


# Register models
admin.site.register(User, CustomUserAdmin)
admin.site.register(SystemAdminProfile, SystemAdminProfileAdmin)
admin.site.register(LecturerProfile, LecturerProfileAdmin)
admin.site.register(StudentProfile, StudentProfileAdmin)
admin.site.register(Department, DepartmentAdmin)
admin.site.register(Course, CourseAdmin)
admin.site.register(Semester, SemesterAdmin)
admin.site.register(Unit, UnitAdmin)
admin.site.register(Enrollment, EnrollmentAdmin)
admin.site.register(SemesterUnit, SemesterUnitAdmin)
admin.site.register(StudentUnitEnrollment, StudentUnitEnrollmentAdmin)
admin.site.register(ClassSchedule, ClassScheduleAdmin)
admin.site.register(QRCode, QRCodeAdmin)
admin.site.register(Attendance, AttendanceAdmin)
admin.site.register(SystemLog, SystemLogAdmin)
admin.site.register(AttendanceReport, AttendanceReportAdmin)
admin.site.register(StudentAttendanceSummary, StudentAttendanceSummaryAdmin)

# Admin site configuration
admin.site.site_header = "Attendify Administration"
admin.site.site_title = "Attendify Admin Portal"
admin.site.index_title = "Welcome to Attendify Administration"