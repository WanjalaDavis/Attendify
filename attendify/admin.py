from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from django.utils.html import format_html
from django.utils import timezone
from django.db.models import Count
from django.http import HttpResponse
from django.contrib import messages
from django.urls import reverse
import csv
import json

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
                StudentProfile.objects.create(user=user)
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
    fields = ('registration_number', 'year_of_study', 'is_active')
    extra = 0


# Inline for Lecturer Profile
class LecturerProfileInline(admin.StackedInline):
    model = LecturerProfile
    can_delete = False
    verbose_name_plural = 'Lecturer Profile'
    fields = ('employee_id', 'specialization', 'qualifications', 'is_active')
    extra = 0


# Inline for Admin Profile
class SystemAdminProfileInline(admin.StackedInline):
    model = SystemAdminProfile
    can_delete = False
    verbose_name_plural = 'Admin Profile'
    fields = ('admin_id', 'department')
    extra = 0


# Custom User Admin with Profile Inlines
class CustomUserAdmin(UserAdmin):
    add_form = CustomUserCreationForm
    form = CustomUserChangeForm
    
    list_display = ('username', 'email', 'get_user_type', 'full_name', 'is_active', 'last_login', 'date_joined')
    list_filter = ('user_type', 'is_active', 'is_staff', 'is_superuser', 'date_joined')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    readonly_fields = ('date_joined', 'last_login', 'created_at', 'updated_at')
    
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
        """Auto-create profile when user is created"""
        super().save_model(request, obj, form, change)
        
        if not change:  # Only for new users
            if obj.is_student and not hasattr(obj, 'student_profile'):
                StudentProfile.objects.create(user=obj)
            elif obj.is_lecturer and not hasattr(obj, 'lecturer_profile'):
                LecturerProfile.objects.create(user=obj)
            elif obj.is_admin and not hasattr(obj, 'admin_profile'):
                SystemAdminProfile.objects.create(user=obj)


# Quick Action Admin Mixin for Easy User Creation
class QuickUserCreationMixin:
    """Mixin to add quick user creation actions"""
    
    @admin.action(description='Create user account for selected profiles')
    def create_user_accounts(self, request, queryset):
        created_count = 0
        for profile in queryset:
            if not hasattr(profile, 'user'):
                # Create a new user
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
    list_display = ('registration_number', 'user_link', 'year_of_study', 'enrollment_date', 'is_active', 'attendance_rate')
    list_filter = ('year_of_study', 'is_active', 'enrollment_date')
    search_fields = ('registration_number', 'user__username', 'user__first_name', 'user__last_name')
    readonly_fields = ('created_at', 'updated_at', 'attendance_rate', 'enrollment_date')
    
    fieldsets = (
        (None, {'fields': ('user', 'registration_number')}),
        ('Academic Info', {'fields': ('year_of_study',)}),
        ('Status', {'fields': ('is_active',)}),
        ('Timestamps', {'fields': ('created_at', 'updated_at', 'enrollment_date')}),
    )
    
    def get_actions(self, request):
        actions = super().get_actions(request)
        actions['create_user_accounts'] = (
            QuickUserCreationMixin.create_user_accounts,
            'create_user_accounts',
            'Create user account for selected profiles'
        )
        return actions
    
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
    
    def user_link(self, obj):
        if obj.user:
            url = reverse('admin:attendify_user_change', args=[obj.user.id])
            return format_html('<a href="{}">{}</a>', url, obj.user.username)
        return "No User Account"
    user_link.short_description = 'User Account'
    user_link.admin_order_field = 'user__username'
    
    def get_form(self, request, obj=None, **kwargs):
        """Add help text for user field"""
        help_texts = {
            'user': 'Select an existing user or create a new student user first in the Users section'
        }
        kwargs.update({'help_texts': help_texts})
        return super().get_form(request, obj, **kwargs)


# Enhanced Lecturer Profile Admin
class LecturerProfileAdmin(admin.ModelAdmin, QuickUserCreationMixin):
    list_display = ('employee_id', 'user_link', 'specialization', 'date_joined', 'is_active', 'teaching_units_count')
    list_filter = ('is_active', 'date_joined', 'specialization')
    search_fields = ('employee_id', 'user__username', 'user__first_name', 'user__last_name', 'specialization')
    readonly_fields = ('employee_id', 'created_at', 'updated_at', 'teaching_units_count', 'date_joined')
    
    fieldsets = (
        (None, {'fields': ('user', 'employee_id')}),
        ('Professional Info', {'fields': ('specialization', 'qualifications')}),
        ('Status', {'fields': ('is_active',)}),
        ('Timestamps', {'fields': ('created_at', 'updated_at', 'date_joined')}),
    )
    
    def get_actions(self, request):
        actions = super().get_actions(request)
        actions['create_user_accounts'] = (
            QuickUserCreationMixin.create_user_accounts,
            'create_user_accounts',
            'Create user account for selected profiles'
        )
        return actions
    
    def teaching_units_count(self, obj):
        return obj.teaching_units.count()
    teaching_units_count.short_description = 'Teaching Units'
    
    def user_link(self, obj):
        if obj.user:
            url = reverse('admin:attendify_user_change', args=[obj.user.id])
            return format_html('<a href="{}">{}</a>', url, obj.user.username)
        return "No User Account"
    user_link.short_description = 'User Account'
    user_link.admin_order_field = 'user__username'
    
    def get_form(self, request, obj=None, **kwargs):
        """Add help text for user field"""
        help_texts = {
            'user': 'Select an existing user or create a new lecturer user first in the Users section'
        }
        kwargs.update({'help_texts': help_texts})
        return super().get_form(request, obj, **kwargs)


# System Admin Profile Admin
class SystemAdminProfileAdmin(admin.ModelAdmin):
    list_display = ('admin_id', 'user', 'department', 'created_at')
    search_fields = ('admin_id', 'user__username', 'department')
    readonly_fields = ('admin_id', 'created_at', 'updated_at')
    list_filter = ('department', 'created_at')


# Department Admin
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'courses_count', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('code', 'name', 'description')
    readonly_fields = ('created_at', 'updated_at', 'courses_count')
    list_editable = ('is_active',)
    
    def courses_count(self, obj):
        return obj.courses.count()
    courses_count.short_description = 'Number of Courses'


# Course Admin
class CourseAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'department', 'course_type', 'duration_years', 'is_active')
    list_filter = ('course_type', 'department', 'is_active', 'duration_years')
    search_fields = ('code', 'name', 'description')
    readonly_fields = ('created_at', 'updated_at', 'semesters_count')
    list_editable = ('is_active',)
    
    def semesters_count(self, obj):
        return obj.semesters.count()
    semesters_count.short_description = 'Number of Semesters'


# Semester Admin
class SemesterAdmin(admin.ModelAdmin):
    list_display = ('name', 'course', 'semester_number', 'start_date', 'end_date', 'is_current')
    list_filter = ('course', 'is_current', 'start_date')
    search_fields = ('name', 'course__code', 'course__name')
    readonly_fields = ('created_at', 'updated_at')
    list_editable = ('is_current',)
    
    def save_model(self, request, obj, form, change):
        if obj.is_current:
            Semester.objects.filter(course=obj.course, is_current=True).update(is_current=False)
        super().save_model(request, obj, form, change)


# Unit Admin
class UnitAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'department', 'credit_hours', 'is_core', 'is_active')
    list_filter = ('department', 'is_core', 'is_active', 'credit_hours')
    search_fields = ('code', 'name', 'description')
    readonly_fields = ('created_at', 'updated_at')
    list_editable = ('is_active', 'is_core')


# Fixed Enrollment Admin
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ('get_student_info', 'course', 'enrollment_date', 'expected_graduation', 'is_active')
    list_filter = ('course', 'is_active', 'enrollment_date')
    search_fields = ('student__registration_number', 'student__user__username', 'student__user__first_name', 'student__user__last_name', 'course__code', 'course__name')
    readonly_fields = ('created_at', 'enrollment_date')
    list_editable = ('is_active',)
    autocomplete_fields = ('student', 'course')  # Add autocomplete for better UX
    
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
            # Only show active students who don't already have an enrollment
            enrolled_student_ids = Enrollment.objects.filter(is_active=True).values_list('student_id', flat=True)
            kwargs["queryset"] = StudentProfile.objects.filter(
                is_active=True
            ).exclude(
                id__in=enrolled_student_ids
            ).select_related('user')
        return super().formfield_for_foreignkey(db_field, request, **kwargs)
    
    def get_form(self, request, obj=None, **kwargs):
        """Improve the form to show better student information"""
        form = super().get_form(request, obj, **kwargs)
        
        # Customize the student field label and help text
        form.base_fields['student'].label = 'Select Student (Registration Number - Name)'
        form.base_fields['student'].help_text = 'Choose a student to enroll in this course. Only active students without existing enrollments are shown.'
        
        return form


# Semester Unit Admin
class SemesterUnitAdmin(admin.ModelAdmin):
    list_display = ('unit', 'semester', 'lecturer', 'max_students', 'current_students', 'enrollment_count')
    list_filter = ('semester', 'lecturer', 'semester__course')
    search_fields = ('unit__code', 'unit__name', 'semester__name', 'lecturer__user__username')
    readonly_fields = ('created_at', 'updated_at', 'current_students', 'enrollment_count')
    autocomplete_fields = ('lecturer', 'unit', 'semester')
    
    def enrollment_count(self, obj):
        return obj.enrolled_students.count()
    enrollment_count.short_description = 'Enrolled Students'


# Student Unit Enrollment Admin
class StudentUnitEnrollmentAdmin(admin.ModelAdmin):
    list_display = ('student', 'semester_unit', 'enrollment_date', 'is_active')
    list_filter = ('semester_unit__semester', 'is_active', 'enrollment_date')
    search_fields = ('student__registration_number', 'semester_unit__unit__code')
    readonly_fields = ('enrollment_date',)
    list_editable = ('is_active',)


# Class Schedule Admin
class ClassScheduleAdmin(admin.ModelAdmin):
    list_display = ('semester_unit', 'schedule_date', 'start_time', 'end_time', 'venue', 'lecturer', 'is_active', 'attendance_count')
    list_filter = ('schedule_date', 'lecturer', 'is_active', 'semester_unit__semester')
    search_fields = ('venue', 'semester_unit__unit__code', 'lecturer__user__username')
    readonly_fields = ('created_at', 'updated_at', 'attendance_count', 'is_ongoing_display')
    list_editable = ('is_active',)
    date_hierarchy = 'schedule_date'
    
    def attendance_count(self, obj):
        return obj.attendances.count()
    attendance_count.short_description = 'Attendance Records'
    
    def is_ongoing_display(self, obj):
        try:
            return obj.is_ongoing if obj.pk else False
        except (TypeError, ValueError):
            return False
    is_ongoing_display.boolean = True
    is_ongoing_display.short_description = 'Is Ongoing'


# QR Code Admin
class QRCodeAdmin(admin.ModelAdmin):
    list_display = ('class_schedule', 'token_short', 'generated_at', 'expires_at', 'is_active', 'is_expired')
    list_filter = ('is_active', 'generated_at')
    search_fields = ('token', 'class_schedule__semester_unit__unit__code')
    readonly_fields = ('token', 'generated_at', 'expires_at', 'is_expired', 'qr_code_preview')
    exclude = ('qr_code_image',)
    
    def token_short(self, obj):
        return obj.token[:20] + '...' if len(obj.token) > 20 else obj.token
    token_short.short_description = 'Token'
    
    def is_expired(self, obj):
        return obj.is_expired
    is_expired.boolean = True
    is_expired.short_description = 'Is Expired'
    
    def qr_code_preview(self, obj):
        if obj.qr_code_image:
            return format_html('<img src="{}" width="200" height="200" />', obj.qr_code_image.url)
        return "No QR Code Generated"
    qr_code_preview.short_description = 'QR Code Preview'


# Attendance Admin
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ('student', 'class_schedule', 'status', 'scan_time', 'location_valid', 'marked_by_lecturer')
    list_filter = ('status', 'location_valid', 'marked_by_lecturer', 'class_schedule__schedule_date')
    search_fields = ('student__registration_number', 'class_schedule__semester_unit__unit__code')
    readonly_fields = ('created_at', 'updated_at', 'was_late')
    list_editable = ('status',)
    actions = ['export_attendance_csv', 'mark_as_present', 'mark_as_absent']
    
    def was_late(self, obj):
        return obj.was_late
    was_late.boolean = True
    was_late.short_description = 'Was Late'
    
    @admin.action(description='Export selected attendance records to CSV')
    def export_attendance_csv(self, request, queryset):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="attendance_export.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'Student ID', 'Student Name', 'Unit Code', 'Unit Name', 
            'Class Date', 'Status', 'Scan Time', 'Location Valid'
        ])
        
        for attendance in queryset:
            writer.writerow([
                attendance.student.registration_number,
                attendance.student.user.get_full_name(),
                attendance.class_schedule.semester_unit.unit.code,
                attendance.class_schedule.semester_unit.unit.name,
                attendance.class_schedule.schedule_date,
                attendance.get_status_display(),
                attendance.scan_time,
                'Yes' if attendance.location_valid else 'No'
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


# System Log Admin
class SystemLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'action_type', 'log_level', 'timestamp', 'ip_address_short')
    list_filter = ('action_type', 'log_level', 'timestamp')
    search_fields = ('user__username', 'description', 'ip_address')
    readonly_fields = ('timestamp', 'user', 'action_type', 'log_level', 'description', 'ip_address', 'user_agent', 'metadata_preview')
    date_hierarchy = 'timestamp'
    
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


# Attendance Report Admin
class AttendanceReportAdmin(admin.ModelAdmin):
    list_display = ('title', 'generated_by', 'semester_unit', 'report_type', 'start_date', 'end_date', 'average_attendance', 'is_generated')
    list_filter = ('report_type', 'is_generated', 'generated_at')
    search_fields = ('title', 'generated_by__user__username', 'semester_unit__unit__code')
    readonly_fields = ('generated_at', 'total_classes', 'total_students', 'average_attendance', 'is_generated')
    actions = ['generate_reports']
    
    @admin.action(description='Generate selected reports')
    def generate_reports(self, request, queryset):
        for report in queryset:
            report.calculate_statistics()
            report.is_generated = True
            report.save()
        self.message_user(request, f'{queryset.count()} reports generated successfully.', messages.SUCCESS)


# Student Attendance Summary Admin
class StudentAttendanceSummaryAdmin(admin.ModelAdmin):
    list_display = ('student', 'semester_unit', 'total_classes', 'classes_attended', 'attendance_percentage', 'last_updated')
    list_filter = ('semester_unit__semester', 'last_updated')
    search_fields = ('student__registration_number', 'semester_unit__unit__code')
    readonly_fields = ('total_classes', 'classes_attended', 'classes_absent', 'classes_late', 'attendance_percentage', 'last_updated')


# Fix the is_ongoing property
def safe_is_ongoing(self):
    from django.utils import timezone
    from datetime import datetime
    
    if not self.schedule_date or not self.start_time or not self.end_time:
        return False
        
    now = timezone.now()
    try:
        class_datetime = timezone.make_aware(datetime.combine(self.schedule_date, self.start_time))
        class_end_datetime = timezone.make_aware(datetime.combine(self.schedule_date, self.end_time))
        return class_datetime <= now <= class_end_datetime
    except (TypeError, ValueError):
        return False

ClassSchedule.is_ongoing = property(safe_is_ongoing)


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