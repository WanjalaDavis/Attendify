from django.contrib.auth.models import AbstractUser, BaseUserManager, Group, Permission
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError
from django.utils import timezone
import uuid
import os

# Validation functions
def validate_year_of_study(value):
    if value < 1 or value > 5:
        raise ValidationError('Year of study must be between 1 and 5')

class CustomUserManager(BaseUserManager):
    def create_user(self, username, password=None, **extra_fields):
        if not username:
            raise ValueError('The Username must be set')
        user = self.model(username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        return self.create_user(username, password, **extra_fields)

def user_profile_picture_path(instance, filename):
    ext = filename.split('.')[-1]
    filename = f"{instance.username}_profile.{ext}"
    return os.path.join('profiles', filename)

def qr_code_image_path(instance, filename):
    ext = filename.split('.')[-1]
    filename = f"qr_{instance.token}.{ext}"
    return os.path.join('qr_codes', filename)

def report_file_path(instance, filename):
    ext = filename.split('.')[-1]
    filename = f"report_{instance.id}.{ext}"
    return os.path.join('reports', filename)

class User(AbstractUser):
    class UserType(models.TextChoices):
        ADMIN = 'ADMIN', _('System Administrator')
        LECTURER = 'LECTURER', _('Lecturer')
        STUDENT = 'STUDENT', _('Student')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_type = models.CharField(
        max_length=10,
        choices=UserType.choices,
        default=UserType.STUDENT
    )
    email = models.EmailField(_('email address'), unique=True, blank=True, null=True)
    phone_number = models.CharField(max_length=15, blank=True, null=True)
    profile_picture = models.ImageField(
        upload_to=user_profile_picture_path,
        default='profiles/default.png',
        blank=True,
        null=True
    )
    date_of_birth = models.DateField(blank=True, null=True)
    age = models.PositiveIntegerField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_verified = models.BooleanField(default=False)

    groups = models.ManyToManyField(
        Group,
        verbose_name=_('groups'),
        blank=True,
        related_name="attendify_user_set",
        related_query_name="attendify_user",
    )
    user_permissions = models.ManyToManyField(
        Permission,
        verbose_name=_('user permissions'),
        blank=True,
        related_name="attendify_user_set",
        related_query_name="attendify_user",
    )

    objects = CustomUserManager()

    class Meta:
        db_table = 'users'
        verbose_name = _('user')
        verbose_name_plural = _('users')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.username} ({self.get_user_type_display()})"

    @property
    def is_admin(self):
        return self.user_type == self.UserType.ADMIN

    @property
    def is_lecturer(self):
        return self.user_type == self.UserType.LECTURER

    @property
    def is_student(self):
        return self.user_type == self.UserType.STUDENT

    def save(self, *args, **kwargs):
        if self.email:
            self.email = self.email.lower()
        super().save(*args, **kwargs)

class SystemAdminProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='admin_profile',
        limit_choices_to={'user_type': User.UserType.ADMIN}
    )
    department = models.CharField(max_length=100, blank=True, null=True)
    admin_id = models.CharField(max_length=20, unique=True, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'system_admin_profiles'
        verbose_name = _('system admin profile')
        verbose_name_plural = _('system admin profiles')

    def __str__(self):
        return f"Admin Profile - {self.user.username}"

    def save(self, *args, **kwargs):
        if not self.admin_id:
            self.admin_id = f"ADM{self.user.id.hex[:8].upper()}"
        super().save(*args, **kwargs)

class LecturerProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='lecturer_profile',
        limit_choices_to={'user_type': User.UserType.LECTURER}
    )
    employee_id = models.CharField(max_length=20, unique=True, blank=True, null=True)
    specialization = models.CharField(max_length=200, blank=True, null=True)
    qualifications = models.TextField(blank=True, null=True)
    date_joined = models.DateField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'lecturer_profiles'
        verbose_name = _('lecturer profile')
        verbose_name_plural = _('lecturer profiles')

    def __str__(self):
        return f"Lecturer - {self.user.get_full_name() or self.user.username}"

    def save(self, *args, **kwargs):
        if not self.employee_id:
            last_lecturer = LecturerProfile.objects.order_by('-id').first()
            if last_lecturer and last_lecturer.employee_id:
                try:
                    last_id = int(last_lecturer.employee_id[3:]) if last_lecturer.employee_id.startswith('EMP') else 0
                    new_id = last_id + 1
                except (ValueError, IndexError):
                    new_id = 1
            else:
                new_id = 1
            self.employee_id = f"EMP{new_id:06d}"
        super().save(*args, **kwargs)

class Department(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'departments'
        verbose_name = _('department')
        verbose_name_plural = _('departments')
        ordering = ['name']

    def __str__(self):
        return f"{self.code} - {self.name}"

class Course(models.Model):
    class CourseType(models.TextChoices):
        DIPLOMA = 'DIPLOMA', _('Diploma')
        BACHELORS = 'BACHELORS', _('Bachelors')
        MASTERS = 'MASTERS', _('Masters')
        PHD = 'PHD', _('PhD')
        CERTIFICATE = 'CERTIFICATE', _('Certificate')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name='courses'
    )
    course_type = models.CharField(
        max_length=20,
        choices=CourseType.choices,
        default=CourseType.BACHELORS
    )
    duration_years = models.PositiveIntegerField(default=4)
    total_semesters = models.PositiveIntegerField(default=8)
    
    # Fixed: Added the missing field that was causing the error
    credit_requirements = models.PositiveIntegerField(
        default=120,
        help_text="Total credit hours required for course completion"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'courses'
        verbose_name = _('course')
        verbose_name_plural = _('courses')
        ordering = ['code']

    def __str__(self):
        return f"{self.code} - {self.name}"

class Semester(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='semesters'
    )
    semester_number = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(12)]
    )
    name = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'semesters'
        verbose_name = _('semester')
        verbose_name_plural = _('semesters')
        unique_together = ['course', 'semester_number']
        ordering = ['course', 'semester_number']

    def __str__(self):
        return f"{self.course.code} - Semester {self.semester_number}"

    def clean(self):
        if self.start_date >= self.end_date:
            raise ValidationError("End date must be after start date")

class Unit(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name='units'
    )
    credit_hours = models.PositiveIntegerField(default=3)
    is_core = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'units'
        verbose_name = _('unit')
        verbose_name_plural = _('units')
        ordering = ['code']

    def __str__(self):
        return f"{self.code} - {self.name}"

class StudentProfile(models.Model):
    class YearOfStudy(models.IntegerChoices):
        FIRST = 1, _('First Year')
        SECOND = 2, _('Second Year')
        THIRD = 3, _('Third Year')
        FOURTH = 4, _('Fourth Year')
        FIFTH = 5, _('Fifth Year')

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='student_profile',
        limit_choices_to={'user_type': User.UserType.STUDENT}
    )
    registration_number = models.CharField(max_length=50, unique=True)
    year_of_study = models.IntegerField(
        choices=YearOfStudy.choices, 
        default=YearOfStudy.FIRST,
        validators=[validate_year_of_study]
    )
    enrollment_date = models.DateField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'student_profiles'
        verbose_name = _('student profile')
        verbose_name_plural = _('student profiles')
        ordering = ['registration_number']

    def __str__(self):
        return f"Student - {self.registration_number}"

    @property
    def full_name(self):
        return self.user.get_full_name()
    
    @property
    def course(self):
        """Get the student's current course from their active enrollment"""
        try:
            enrollment = self.enrollments.filter(is_active=True).first()
            return enrollment.course if enrollment else None
        except Exception:
            return None

    @property
    def department(self):
        """Get the student's department from their course or units"""
        try:
            # Try to get from course first
            if self.course:
                return self.course.department
            
            # Fallback: get from first enrolled unit
            enrollment = self.unit_enrollments.filter(is_active=True).first()
            if enrollment and enrollment.semester_unit.unit.department:
                return enrollment.semester_unit.unit.department
            
            return None
        except Exception:
            return None

    @property
    def current_semester(self):
        """Get the current semester based on enrollment"""
        try:
            enrollment = self.enrollments.filter(is_active=True).first()
            if enrollment and enrollment.course:
                return enrollment.course.semesters.filter(is_current=True).first()
            return None
        except Exception:
            return None

class Enrollment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        StudentProfile,
        on_delete=models.CASCADE,
        related_name='enrollments'  
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='enrollments'
    )
    enrollment_date = models.DateField(auto_now_add=True)
    expected_graduation = models.DateField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'enrollments'
        verbose_name = _('enrollment')
        verbose_name_plural = _('enrollments')
        unique_together = ['student', 'course']

    def __str__(self):
        return f"{self.student.registration_number} - {self.course.code}"

class SemesterUnit(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    semester = models.ForeignKey(
        Semester,
        on_delete=models.CASCADE,
        related_name='semester_units'
    )
    unit = models.ForeignKey(
        Unit,
        on_delete=models.CASCADE,
        related_name='semester_units'
    )
    lecturer = models.ForeignKey(
        LecturerProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='teaching_units'
    )
    max_students = models.PositiveIntegerField(default=50)
    current_students = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'semester_units'
        verbose_name = _('semester unit')
        verbose_name_plural = _('semester units')
        unique_together = ['semester', 'unit']

    def __str__(self):
        return f"{self.unit.code} - {self.semester}"

    def update_student_count(self):
        self.current_students = self.enrolled_students.count()
        self.save()

class StudentUnitEnrollment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        StudentProfile,
        on_delete=models.CASCADE,
        related_name='unit_enrollments'
    )
    semester_unit = models.ForeignKey(
        SemesterUnit,
        on_delete=models.CASCADE,
        related_name='enrolled_students'
    )
    enrollment_date = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'student_unit_enrollments'
        verbose_name = _('student unit enrollment')
        verbose_name_plural = _('student unit enrollments')
        unique_together = ['student', 'semester_unit']

    def __str__(self):
        return f"{self.student.registration_number} - {self.semester_unit.unit.code}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.semester_unit.update_student_count()

class ClassSchedule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    semester_unit = models.ForeignKey(
        SemesterUnit,
        on_delete=models.CASCADE,
        related_name='class_schedules'
    )
    lecturer = models.ForeignKey(
        LecturerProfile,
        on_delete=models.CASCADE,
        related_name='scheduled_classes'
    )
    schedule_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    venue = models.CharField(max_length=200)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    location_radius = models.PositiveIntegerField(default=50)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'class_schedules'
        verbose_name = _('class schedule')
        verbose_name_plural = _('class schedules')
        ordering = ['-schedule_date', 'start_time']

    def __str__(self):
        return f"{self.semester_unit.unit.code} - {self.schedule_date} {self.start_time}"

    def clean(self):
        """Fixed: Added None checks to prevent TypeError"""
        errors = {}
        
        # Check if times are provided before comparison
        if self.start_time is not None and self.end_time is not None:
            if self.start_time >= self.end_time:
                errors['end_time'] = 'End time must be after start time'
        else:
            # If times are not set, we can't validate the time comparison
            # But we should ensure they are provided
            if self.start_time is None:
                errors['start_time'] = 'Start time is required'
            if self.end_time is None:
                errors['end_time'] = 'End time is required'
        
        # Validate date
        if self.schedule_date:
            if self.schedule_date < timezone.now().date():
                errors['schedule_date'] = 'Class date cannot be in the past'
        else:
            errors['schedule_date'] = 'Schedule date is required'
        
        if errors:
            raise ValidationError(errors)

    @property
    def is_ongoing(self):
        from django.utils import timezone
        from datetime import datetime
        
        if not self.schedule_date or not self.start_time or not self.end_time:
            return False
            
        now = timezone.now()
        try:
            class_datetime = timezone.make_aware(
                datetime.combine(self.schedule_date, self.start_time)
            )
            class_end_datetime = timezone.make_aware(
                datetime.combine(self.schedule_date, self.end_time)
            )
            return class_datetime <= now <= class_end_datetime
        except (TypeError, ValueError):
            return False

class QRCode(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    class_schedule = models.OneToOneField(
        ClassSchedule,
        on_delete=models.CASCADE,
        related_name='qr_code'
    )
    token = models.CharField(max_length=100, unique=True)
    qr_code_image = models.ImageField(
        upload_to=qr_code_image_path,
        blank=True,
        null=True
    )
    is_active = models.BooleanField(default=True)
    generated_at = models.DateTimeField(auto_now_add=True)    
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'qr_codes'
        verbose_name = _('QR code')
        verbose_name_plural = _('QR codes')
        ordering = ['-generated_at']

    def __str__(self):
        return f"QR Code - {self.class_schedule}"

    @property
    def is_expired(self):
        from django.utils import timezone
        if not self.expires_at:
            return False
        return timezone.now() > self.expires_at

    def save(self, *args, **kwargs):
        if not self.token:
            import secrets
            self.token = secrets.token_urlsafe(32)
        super().save(*args, **kwargs)

class Attendance(models.Model):
    class AttendanceStatus(models.TextChoices):
        PRESENT = 'PRESENT', _('Present')
        ABSENT = 'ABSENT', _('Absent')
        LATE = 'LATE', _('Late')
        EXCUSED = 'EXCUSED', _('Excused')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        StudentProfile,
        on_delete=models.CASCADE,
        related_name='attendances'
    )
    class_schedule = models.ForeignKey(
        ClassSchedule,
        on_delete=models.CASCADE,
        related_name='attendances'
    )
    qr_code = models.ForeignKey(
        QRCode,
        on_delete=models.CASCADE,
        related_name='attendances',
        null=True,
        blank=True
    )
    status = models.CharField(
        max_length=10,
        choices=AttendanceStatus.choices,
        default=AttendanceStatus.ABSENT
    )
    scan_time = models.DateTimeField(null=True, blank=True)
    scan_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    scan_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    location_valid = models.BooleanField(default=False)
    marked_by_lecturer = models.BooleanField(default=False)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'attendances'
        verbose_name = _('attendance')
        verbose_name_plural = _('attendances')
        unique_together = ['student', 'class_schedule']
        ordering = ['-class_schedule__schedule_date', 'student']
        indexes = [
            models.Index(fields=['student', 'class_schedule']),
            models.Index(fields=['status', 'scan_time']),
        ]

    def __str__(self):
        return f"{self.student.registration_number} - {self.class_schedule} - {self.status}"

    def save(self, *args, **kwargs):
        if not self.scan_time and not self.marked_by_lecturer:
            from django.utils import timezone
            # Fixed: Added None checks for class schedule times
            if (self.class_schedule and 
                self.class_schedule.end_time and 
                self.class_schedule.schedule_date):
                
                class_end = self.class_schedule.end_time
                schedule_date = self.class_schedule.schedule_date
                class_end_datetime = timezone.make_aware(
                    timezone.datetime.combine(schedule_date, class_end)
                )
                
                if timezone.now() > class_end_datetime and self.status == self.AttendanceStatus.ABSENT:
                    self.status = self.AttendanceStatus.ABSENT
        super().save(*args, **kwargs)

    @property
    def was_late(self):
        if self.scan_time:
            from django.utils import timezone
            # Fixed: Added None checks for class schedule times
            if (self.class_schedule and 
                self.class_schedule.start_time and 
                self.class_schedule.schedule_date):
                
                class_start = self.class_schedule.start_time
                schedule_date = self.class_schedule.schedule_date
                class_start_datetime = timezone.make_aware(
                    timezone.datetime.combine(schedule_date, class_start)
                )
                return self.scan_time > class_start_datetime
        return False

class SystemLog(models.Model):
    class LogLevel(models.TextChoices):
        INFO = 'INFO', _('Information')
        WARNING = 'WARNING', _('Warning')
        ERROR = 'ERROR', _('Error')
        DEBUG = 'DEBUG', _('Debug')

    class ActionType(models.TextChoices):
        LOGIN = 'LOGIN', _('User Login')
        LOGOUT = 'LOGOUT', _('User Logout')
        CREATE = 'CREATE', _('Create Record')
        UPDATE = 'UPDATE', _('Update Record')
        DELETE = 'DELETE', _('Delete Record')
        SCAN = 'SCAN', _('QR Code Scan')
        REPORT = 'REPORT', _('Generate Report')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='system_logs'
    )
    action_type = models.CharField(max_length=10, choices=ActionType.choices)
    log_level = models.CharField(max_length=10, choices=LogLevel.choices, default=LogLevel.INFO)
    description = models.TextField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'system_logs'
        verbose_name = _('system log')
        verbose_name_plural = _('system logs')
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['action_type', 'timestamp']),
        ]

    def __str__(self):
        return f"{self.get_action_type_display()} - {self.user.username if self.user else 'System'}"

class AttendanceReport(models.Model):
    class ReportType(models.TextChoices):
        DAILY = 'DAILY', _('Daily Report')
        WEEKLY = 'WEEKLY', _('Weekly Report')
        MONTHLY = 'MONTHLY', _('Monthly Report')
        SEMESTER = 'SEMESTER', _('Semester Report')
        CUSTOM = 'CUSTOM', _('Custom Period Report')

    class ReportFormat(models.TextChoices):
        PDF = 'PDF', _('PDF')
        EXCEL = 'EXCEL', _('Excel')
        CSV = 'CSV', _('CSV')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    generated_by = models.ForeignKey(
        LecturerProfile,
        on_delete=models.CASCADE,
        related_name='generated_reports'
    )
    semester_unit = models.ForeignKey(
        SemesterUnit,
        on_delete=models.CASCADE,
        related_name='attendance_reports'
    )
    report_type = models.CharField(max_length=10, choices=ReportType.choices)
    report_format = models.CharField(max_length=10, choices=ReportFormat.choices, default=ReportFormat.PDF)
    title = models.CharField(max_length=200)
    start_date = models.DateField()
    end_date = models.DateField()
    total_classes = models.PositiveIntegerField(default=0)
    total_students = models.PositiveIntegerField(default=0)
    average_attendance = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)
    report_file = models.FileField(upload_to=report_file_path, blank=True, null=True)
    generated_at = models.DateTimeField(auto_now_add=True)
    is_generated = models.BooleanField(default=False)

    class Meta:
        db_table = 'attendance_reports'
        verbose_name = _('attendance report')
        verbose_name_plural = _('attendance reports')
        ordering = ['-generated_at']

    def __str__(self):
        return f"Report - {self.title}"

    def calculate_statistics(self):
        from django.db.models import Count, Avg
        
        attendances = Attendance.objects.filter(
            class_schedule__semester_unit=self.semester_unit,
            class_schedule__schedule_date__range=[self.start_date, self.end_date]
        )
        
        self.total_classes = attendances.values('class_schedule').distinct().count()
        self.total_students = attendances.values('student').distinct().count()
        
        if self.total_classes > 0 and self.total_students > 0:
            total_possible_attendances = self.total_classes * self.total_students
            if total_possible_attendances > 0:
                present_attendances = attendances.filter(
                    status__in=['PRESENT', 'LATE']
                ).count()
                attendance_rate = (present_attendances / total_possible_attendances) * 100
                self.average_attendance = round(attendance_rate, 2)
        
        self.save()

class StudentAttendanceSummary(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        StudentProfile,
        on_delete=models.CASCADE,
        related_name='attendance_summaries'
    )
    semester_unit = models.ForeignKey(
        SemesterUnit,
        on_delete=models.CASCADE,
        related_name='student_summaries'
    )
    total_classes = models.PositiveIntegerField(default=0)
    classes_attended = models.PositiveIntegerField(default=0)
    classes_absent = models.PositiveIntegerField(default=0)
    classes_late = models.PositiveIntegerField(default=0)
    attendance_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'student_attendance_summaries'
        verbose_name = _('student attendance summary')
        verbose_name_plural = _('student attendance summaries')
        unique_together = ['student', 'semester_unit']
        ordering = ['-attendance_percentage']

    def __str__(self):
        return f"Summary - {self.student.registration_number} - {self.semester_unit.unit.code}"

    def calculate_summary(self):
        attendances = Attendance.objects.filter(
            student=self.student,
            class_schedule__semester_unit=self.semester_unit
        )
        
        self.total_classes = attendances.count()
        self.classes_attended = attendances.filter(status='PRESENT').count()
        self.classes_absent = attendances.filter(status='ABSENT').count()
        self.classes_late = attendances.filter(status='LATE').count()
        
        if self.total_classes > 0:
            self.attendance_percentage = round(
                (self.classes_attended + self.classes_late) / self.total_classes * 100, 2
            )
        
        self.save()