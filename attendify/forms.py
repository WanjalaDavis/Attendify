from django import forms
from django.contrib.auth.forms import UserCreationForm as BaseUserCreationForm, PasswordChangeForm
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _
from .models import *
from django.utils import timezone


# User Management Forms
class UserCreationForm(BaseUserCreationForm):
    email = forms.EmailField(required=True, widget=forms.EmailInput(attrs={
        'class': 'form-control',
        'placeholder': 'Enter email address'
    }))
    first_name = forms.CharField(required=True, widget=forms.TextInput(attrs={
        'class': 'form-control',
        'placeholder': 'Enter first name'
    }))
    last_name = forms.CharField(required=True, widget=forms.TextInput(attrs={
        'class': 'form-control',
        'placeholder': 'Enter last name'
    }))
    
    class Meta:
        model = User
        fields = ('username', 'email', 'first_name', 'last_name', 'password1', 'password2')
        widgets = {
            'username': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Enter username'
            }),
        }
    
    def clean_email(self):
        email = self.cleaned_data.get('email')
        if email and User.objects.filter(email=email).exists():
            raise ValidationError("A user with this email already exists.")
        return email.lower()
    
    def clean_username(self):
        username = self.cleaned_data.get('username')
        if User.objects.filter(username=username).exists():
            raise ValidationError("A user with this username already exists.")
        return username


class UserUpdateForm(forms.ModelForm):
    email = forms.EmailField(required=True, widget=forms.EmailInput(attrs={
        'class': 'form-control'
    }))
    phone_number = forms.CharField(required=False, widget=forms.TextInput(attrs={
        'class': 'form-control',
        'placeholder': 'Enter phone number'
    }))
    date_of_birth = forms.DateField(required=False, widget=forms.DateInput(attrs={
        'class': 'form-control',
        'type': 'date'
    }))
    age = forms.IntegerField(required=False, widget=forms.NumberInput(attrs={
        'class': 'form-control',
        'placeholder': 'Enter age'
    }))
    
    class Meta:
        model = User
        fields = ('first_name', 'last_name', 'email', 'phone_number', 'profile_picture', 'date_of_birth', 'age')
        widgets = {
            'first_name': forms.TextInput(attrs={'class': 'form-control'}),
            'last_name': forms.TextInput(attrs={'class': 'form-control'}),
            'profile_picture': forms.FileInput(attrs={'class': 'form-control'}),
        }


class CustomPasswordChangeForm(PasswordChangeForm):
    old_password = forms.CharField(
        widget=forms.PasswordInput(attrs={'class': 'form-control', 'placeholder': 'Current password'})
    )
    new_password1 = forms.CharField(
        widget=forms.PasswordInput(attrs={'class': 'form-control', 'placeholder': 'New password'})
    )
    new_password2 = forms.CharField(
        widget=forms.PasswordInput(attrs={'class': 'form-control', 'placeholder': 'Confirm new password'})
    )


# Profile Forms
class StudentProfileForm(forms.ModelForm):
    registration_number = forms.CharField(
        max_length=50,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Enter registration number'
        })
    )
    year_of_study = forms.ChoiceField(
        choices=StudentProfile.YearOfStudy.choices,
        widget=forms.Select(attrs={'class': 'form-control'})
    )
    
    class Meta:
        model = StudentProfile
        fields = ('registration_number', 'year_of_study')


class LecturerProfileForm(forms.ModelForm):
    employee_id = forms.CharField(
        max_length=20,
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Auto-generated if left blank'
        })
    )
    specialization = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Enter specialization'
        })
    )
    qualifications = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={
            'class': 'form-control',
            'placeholder': 'Enter qualifications',
            'rows': 3
        })
    )
    
    class Meta:
        model = LecturerProfile
        fields = ('employee_id', 'specialization', 'qualifications')


class AdminProfileForm(forms.ModelForm):
    department = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Enter department'
        })
    )
    admin_id = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Auto-generated if left blank'
        })
    )
    
    class Meta:
        model = SystemAdminProfile
        fields = ('department', 'admin_id')


# Academic Management Forms
class DepartmentForm(forms.ModelForm):
    code = forms.CharField(
        max_length=10,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'e.g., CS, IT, ENG'
        })
    )
    name = forms.CharField(
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Enter department name'
        })
    )
    description = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={
            'class': 'form-control',
            'placeholder': 'Enter department description',
            'rows': 3
        })
    )
    
    class Meta:
        model = Department
        fields = ('code', 'name', 'description', 'is_active')
        widgets = {
            'is_active': forms.CheckboxInput(attrs={'class': 'form-check-input'})
        }


class CourseForm(forms.ModelForm):
    code = forms.CharField(
        max_length=20,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'e.g., BSC-CS, MBA, PHD-IT'
        })
    )
    name = forms.CharField(
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Enter course name'
        })
    )
    description = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={
            'class': 'form-control',
            'placeholder': 'Enter course description',
            'rows': 3
        })
    )
    course_type = forms.ChoiceField(
        choices=Course.CourseType.choices,
        widget=forms.Select(attrs={'class': 'form-control'})
    )
    duration_years = forms.IntegerField(
        initial=4,
        widget=forms.NumberInput(attrs={
            'class': 'form-control',
            'min': 1,
            'max': 6
        })
    )
    total_semesters = forms.IntegerField(
        initial=8,
        widget=forms.NumberInput(attrs={
            'class': 'form-control',
            'min': 1,
            'max': 12
        })
    )
    
    class Meta:
        model = Course
        fields = ('code', 'name', 'description', 'department', 'course_type', 'duration_years', 'total_semesters', 'is_active')
        widgets = {
            'department': forms.Select(attrs={'class': 'form-control'}),
            'is_active': forms.CheckboxInput(attrs={'class': 'form-check-input'})
        }


class SemesterForm(forms.ModelForm):
    semester_number = forms.IntegerField(
        widget=forms.NumberInput(attrs={
            'class': 'form-control',
            'min': 1,
            'max': 12
        })
    )
    name = forms.CharField(
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'e.g., Fall 2024, Spring 2024'
        })
    )
    start_date = forms.DateField(
        widget=forms.DateInput(attrs={
            'class': 'form-control',
            'type': 'date'
        })
    )
    end_date = forms.DateField(
        widget=forms.DateInput(attrs={
            'class': 'form-control',
            'type': 'date'
        })
    )
    
    class Meta:
        model = Semester
        fields = ('course', 'semester_number', 'name', 'start_date', 'end_date', 'is_current')
        widgets = {
            'course': forms.Select(attrs={'class': 'form-control'}),
            'is_current': forms.CheckboxInput(attrs={'class': 'form-check-input'})
        }
    
    def clean(self):
        cleaned_data = super().clean()
        start_date = cleaned_data.get('start_date')
        end_date = cleaned_data.get('end_date')
        
        if start_date and end_date and start_date >= end_date:
            raise ValidationError("End date must be after start date.")
        
        return cleaned_data


class UnitForm(forms.ModelForm):
    code = forms.CharField(
        max_length=20,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'e.g., CS101, MATH201'
        })
    )
    name = forms.CharField(
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Enter unit name'
        })
    )
    description = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={
            'class': 'form-control',
            'placeholder': 'Enter unit description',
            'rows': 3
        })
    )
    credit_hours = forms.IntegerField(
        initial=3,
        widget=forms.NumberInput(attrs={
            'class': 'form-control',
            'min': 1,
            'max': 6
        })
    )
    
    class Meta:
        model = Unit
        fields = ('code', 'name', 'description', 'department', 'credit_hours', 'is_core', 'is_active')
        widgets = {
            'department': forms.Select(attrs={'class': 'form-control'}),
            'is_core': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'is_active': forms.CheckboxInput(attrs={'class': 'form-check-input'})
        }


class EnrollmentForm(forms.ModelForm):
    expected_graduation = forms.DateField(
        widget=forms.DateInput(attrs={
            'class': 'form-control',
            'type': 'date'
        })
    )
    
    class Meta:
        model = Enrollment
        fields = ('student', 'course', 'expected_graduation')
        widgets = {
            'student': forms.Select(attrs={'class': 'form-control'}),
            'course': forms.Select(attrs={'class': 'form-control'}),
        }
    
    def clean(self):
        cleaned_data = super().clean()
        student = cleaned_data.get('student')
        course = cleaned_data.get('course')
        
        if student and course:
            if Enrollment.objects.filter(student=student, course=course).exists():
                raise ValidationError("This student is already enrolled in this course.")
        
        return cleaned_data


class SemesterUnitForm(forms.ModelForm):
    max_students = forms.IntegerField(
        initial=50,
        widget=forms.NumberInput(attrs={
            'class': 'form-control',
            'min': 1,
            'max': 200
        })
    )
    
    class Meta:
        model = SemesterUnit
        fields = ('semester', 'unit', 'lecturer', 'max_students')
        widgets = {
            'semester': forms.Select(attrs={'class': 'form-control'}),
            'unit': forms.Select(attrs={'class': 'form-control'}),
            'lecturer': forms.Select(attrs={'class': 'form-control'}),
        }


# Attendance Management Forms
class ClassScheduleForm(forms.ModelForm):
    schedule_date = forms.DateField(
        widget=forms.DateInput(attrs={
            'class': 'form-control',
            'type': 'date'
        })
    )
    start_time = forms.TimeField(
        widget=forms.TimeInput(attrs={
            'class': 'form-control',
            'type': 'time'
        })
    )
    end_time = forms.TimeField(
        widget=forms.TimeInput(attrs={
            'class': 'form-control',
            'type': 'time'
        })
    )
    venue = forms.CharField(
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Enter venue (e.g., Room 101, Lab A)'
        })
    )
    latitude = forms.DecimalField(
        max_digits=9,
        decimal_places=6,
        widget=forms.NumberInput(attrs={
            'class': 'form-control',
            'placeholder': 'Enter latitude',
            'step': '0.000001'
        })
    )
    longitude = forms.DecimalField(
        max_digits=9,
        decimal_places=6,
        widget=forms.NumberInput(attrs={
            'class': 'form-control',
            'placeholder': 'Enter longitude',
            'step': '0.000001'
        })
    )
    location_radius = forms.IntegerField(
        initial=50,
        widget=forms.NumberInput(attrs={
            'class': 'form-control',
            'placeholder': 'Radius in meters',
            'min': 10,
            'max': 1000
        })
    )
    
    class Meta:
        model = ClassSchedule
        fields = ('semester_unit', 'schedule_date', 'start_time', 'end_time', 'venue', 'latitude', 'longitude', 'location_radius')
        widgets = {
            'semester_unit': forms.Select(attrs={'class': 'form-control'}),
        }
    
    def __init__(self, *args, **kwargs):
        self.lecturer = kwargs.pop('lecturer', None)
        super().__init__(*args, **kwargs)
        if self.lecturer:
            self.fields['semester_unit'].queryset = SemesterUnit.objects.filter(lecturer=self.lecturer)
    
    def clean(self):
        cleaned_data = super().clean()
        start_time = cleaned_data.get('start_time')
        end_time = cleaned_data.get('end_time')
        schedule_date = cleaned_data.get('schedule_date')
        
        if start_time and end_time and start_time >= end_time:
            raise ValidationError("End time must be after start time.")
        
        if schedule_date and schedule_date < timezone.now().date():
            raise ValidationError("Cannot schedule class in the past.")
        
        return cleaned_data


class AttendanceReportForm(forms.ModelForm):
    title = forms.CharField(
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Enter report title'
        })
    )
    start_date = forms.DateField(
        widget=forms.DateInput(attrs={
            'class': 'form-control',
            'type': 'date'
        })
    )
    end_date = forms.DateField(
        widget=forms.DateInput(attrs={
            'class': 'form-control',
            'type': 'date'
        })
    )
    report_type = forms.ChoiceField(
        choices=AttendanceReport.ReportType.choices,
        widget=forms.Select(attrs={'class': 'form-control'})
    )
    report_format = forms.ChoiceField(
        choices=AttendanceReport.ReportFormat.choices,
        widget=forms.Select(attrs={'class': 'form-control'})
    )
    
    class Meta:
        model = AttendanceReport
        fields = ('semester_unit', 'report_type', 'report_format', 'title', 'start_date', 'end_date')
        widgets = {
            'semester_unit': forms.Select(attrs={'class': 'form-control'}),
        }
    
    def __init__(self, *args, **kwargs):
        self.lecturer = kwargs.pop('lecturer', None)
        super().__init__(*args, **kwargs)
        if self.lecturer:
            self.fields['semester_unit'].queryset = SemesterUnit.objects.filter(lecturer=self.lecturer)
    
    def clean(self):
        cleaned_data = super().clean()
        start_date = cleaned_data.get('start_date')
        end_date = cleaned_data.get('end_date')
        
        if start_date and end_date and start_date > end_date:
            raise ValidationError("End date must be after start date.")
        
        return cleaned_data


# QR Code Scanning Form
class QRScanForm(forms.Form):
    qr_token = forms.CharField(
        max_length=100,
        widget=forms.HiddenInput()
    )
    latitude = forms.DecimalField(
        max_digits=9,
        decimal_places=6,
        widget=forms.HiddenInput()
    )
    longitude = forms.DecimalField(
        max_digits=9,
        decimal_places=6,
        widget=forms.HiddenInput()
    )


# Manual Attendance Form
class ManualAttendanceForm(forms.ModelForm):
    student = forms.ModelChoiceField(
        queryset=StudentProfile.objects.none(),
        widget=forms.Select(attrs={'class': 'form-control'})
    )
    status = forms.ChoiceField(
        choices=Attendance.AttendanceStatus.choices,
        widget=forms.Select(attrs={'class': 'form-control'})
    )
    notes = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={
            'class': 'form-control',
            'placeholder': 'Enter any notes (optional)',
            'rows': 2
        })
    )
    
    class Meta:
        model = Attendance
        fields = ('student', 'status', 'notes')
    
    def __init__(self, *args, **kwargs):
        self.class_schedule = kwargs.pop('class_schedule', None)
        super().__init__(*args, **kwargs)
        
        if self.class_schedule:
            enrolled_students = StudentUnitEnrollment.objects.filter(
                semester_unit=self.class_schedule.semester_unit
            ).values_list('student', flat=True)
            self.fields['student'].queryset = StudentProfile.objects.filter(id__in=enrolled_students)


# Filter and Search Forms
class DateRangeFilterForm(forms.Form):
    start_date = forms.DateField(
        required=False,
        widget=forms.DateInput(attrs={
            'class': 'form-control',
            'type': 'date'
        })
    )
    end_date = forms.DateField(
        required=False,
        widget=forms.DateInput(attrs={
            'class': 'form-control',
            'type': 'date'
        })
    )


class StudentSearchForm(forms.Form):
    registration_number = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Search by registration number'
        })
    )
    name = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Search by name'
        })
    )
    course = forms.ModelChoiceField(
        required=False,
        queryset=Course.objects.all(),
        widget=forms.Select(attrs={'class': 'form-control'})
    )


class AttendanceFilterForm(forms.Form):
    semester_unit = forms.ModelChoiceField(
        required=False,
        queryset=SemesterUnit.objects.all(),
        widget=forms.Select(attrs={'class': 'form-control'})
    )
    status = forms.ChoiceField(
        required=False,
        choices=[('', 'All Statuses')] + list(Attendance.AttendanceStatus.choices),
        widget=forms.Select(attrs={'class': 'form-control'})
    )
    date_range = forms.ChoiceField(
        required=False,
        choices=[
            ('', 'All Time'),
            ('today', 'Today'),
            ('week', 'This Week'),
            ('month', 'This Month'),
            ('semester', 'This Semester')
        ],
        widget=forms.Select(attrs={'class': 'form-control'})
    )