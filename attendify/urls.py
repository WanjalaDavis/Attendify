from django.urls import path
from django.contrib.auth import views as auth_views
from django.conf import settings
from django.conf.urls.static import static
from . import views

urlpatterns = [
  
    path("", views.login_view, name="login"), 
    path("logout/", views.logout_view, name="logout"),
    path("change-password/", views.change_password, name="change_password"),
    
    
    path("password-reset/", 
         auth_views.PasswordResetView.as_view(
             template_name='auth/password_reset.html',
             email_template_name='auth/password_reset_email.html',
             subject_template_name='auth/password_reset_subject.txt'
         ), 
         name="password_reset"),
    path("password-reset/done/", 
         auth_views.PasswordResetDoneView.as_view(
             template_name='auth/password_reset_done.html'
         ), 
         name="password_reset_done"),
    path("password-reset-confirm/<uidb64>/<token>/", 
         auth_views.PasswordResetConfirmView.as_view(
             template_name='auth/password_reset_confirm.html'
         ), 
         name="password_reset_confirm"),
    path("password-reset-complete/", 
         auth_views.PasswordResetCompleteView.as_view(
             template_name='auth/password_reset_complete.html'
         ), 
         name="password_reset_complete"),

    path("profile/", views.profile_view, name="profile"),
    path("profile/edit/", views.profile_edit, name="profile_edit"),

    path("dashboard/", views.dashboard_redirect, name="dashboard_redirect"),

    # -------------------------------------------------------------------
    path("student/dashboard/", views.student_dashboard, name="student_dashboard"),
    path("student/portal/", views.student_portal, name="student_portal"),
    path("student/attendance-history/", views.student_attendance_history, name="student_attendance_history"),
    path("student/unit-attendance/<uuid:unit_id>/", views.student_unit_attendance, name="student_unit_attendance"),

    path("lecturer/dashboard/", views.lecturer_dashboard, name="lecturer_dashboard"),
    path("lecturer/portal/", views.lecturer_portal, name="lecturer_portal"),
    path("lecturer/attendance/", views.lecturer_attendance, name="lecturer_attendance"),
    path("lecturer/generate-qr/<uuid:class_id>/", views.generate_qr_code, name="generate_qr_code"),
    path("lecturer/attendance/<uuid:class_id>/manual/", views.mark_attendance_manual, name="mark_attendance_manual"),
    path("lecturer/schedule-class/", views.schedule_class, name="schedule_class"),
    path("lecturer/generate-report/", views.generate_report, name="generate_report"),

    path("admin/dashboard/", views.admin_dashboard, name="admin_dashboard"),
    path("admin/students/", views.manage_students, name="manage_students"),
    path("admin/students/create/", views.create_student, name="create_student"),
    path("admin/lecturers/", views.manage_lecturers, name="manage_lecturers"),
    path("admin/lecturers/create/", views.create_lecturer, name="create_lecturer"),
    path("admin/units/", views.manage_units, name="manage_units"),
    path("admin/units/create/", views.create_unit, name="create_unit"),
    path("admin/courses/", views.manage_courses, name="manage_courses"),
    path("admin/courses/create/", views.create_course, name="create_course"),
    path("admin/departments/", views.manage_departments, name="manage_departments"),
    path("admin/departments/create/", views.create_department, name="create_department"),
    path("admin/semesters/", views.manage_semesters, name="manage_semesters"),
    path("admin/semesters/create/", views.create_semester, name="create_semester"),
    path("admin/enrollments/", views.enroll_student, name="enroll_student"),
    path("admin/assignments/", views.assign_unit_lecturer, name="assign_unit_lecturer"),
    path("admin/system-logs/", views.system_logs, name="system_logs"),

   
    path("api/system-stats/", views.api_system_stats, name="api_system_stats"),
    path("api/scan-qr/", views.scan_qr_code, name="scan_qr_code"),
    path("api/student/<uuid:student_id>/attendance/", views.api_student_attendance, name="api_student_attendance"),
    
    # Class attendance - FIXED: Using string instead of UUID to match JavaScript
    path("api/class/<str:class_id>/attendance/", views.api_class_attendance, name="api_class_attendance"),
    
    path("api/class-list/", views.api_class_list, name="api_class_list"),
    path("api/today-classes/", views.api_today_classes, name="api_today_classes"),

    # Student API endpoints
    path('api/recent-attendance/', views.recent_attendance_api, name='recent_attendance_api'),
    path('api/attendance-stats/', views.attendance_stats_api, name='attendance_stats_api'),
    path('api/unit-analytics/<uuid:unit_id>/', views.unit_analytics_api, name='unit_analytics_api'),
    path('api/export-attendance-csv/', views.export_attendance_csv, name='export_attendance_csv'),
    path('api/attendance-history/', views.attendance_history_api, name='attendance_history_api'),
    
    # QR Scanning endpoint
    path('scan-qr-code/', views.scan_qr_code_endpoint, name='scan_qr_code'),
    
    # Lecturer APIs - ALL MISSING ENDPOINTS ADDED
    path("api/lecturer/recent-attendance/", views.api_lecturer_recent_attendance, name="api_lecturer_recent_attendance"),
    path("api/lecturer/classes/", views.api_lecturer_classes, name="api_lecturer_classes"),
    path("api/lecturer/units/", views.api_lecturer_units, name="api_lecturer_units"),
    path("api/lecturer/reports/", views.api_lecturer_reports, name="api_lecturer_reports"),
    path("api/lecturer/unit-analytics/<str:unit_id>/", views.api_unit_analytics, name="api_unit_analytics"),
    path("api/lecturer/reports-preview/", views.api_reports_preview, name="api_reports_preview"),
    path("api/lecturer/schedule-class/", views.api_schedule_class, name="api_schedule_class"),
    path("api/lecturer/mark-manual-attendance/", views.api_mark_manual_attendance, name="api_mark_manual_attendance"),
]

handler403 = views.handler403
handler404 = views.handler404
handler500 = views.handler500

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)