from django.urls import path
from django.contrib.auth import views as auth_views
from django.conf import settings
from django.conf.urls.static import static
from . import views

urlpatterns = [
    # Authentication
    path("", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("change-password/", views.change_password, name="change_password"),

    # Profile
    path("profile/", views.profile_view, name="profile"),
    path("profile/edit/", views.profile_edit, name="profile_edit"),

    # Unified dashboard redirect
    path("dashboard/", views.dashboard_redirect, name="dashboard_redirect"),

    # Student routes
    path("student/dashboard/", views.student_dashboard, name="student_dashboard"),
    path("student/portal/", views.student_portal, name="student_portal"),

    # Lecturer routes
    path("lecturer/dashboard/", views.lecturer_dashboard, name="lecturer_dashboard"),
    path("lecturer/portal/", views.lecturer_portal, name="lecturer_portal"),
    path("lecturer/attendance/", views.lecturer_attendance, name="lecturer_attendance"),
    path(
        "lecturer/generate-qr/<uuid:class_id>/",
        views.generate_qr_code,
        name="generate_qr_code",
    ),
    # path("lecturer/attendance/<uuid:class_id>/", views.view_class_attendance, name="view_class_attendance"),
    path(
        "lecturer/attendance/<uuid:class_id>/manual/",
        views.mark_attendance_manual,
        name="mark_attendance_manual",
    ),

    # API routes
    path("api/scan-qr/", views.scan_qr_code, name="scan_qr_code"),
    path(
        "api/student/<uuid:student_id>/attendance/",
        views.api_student_attendance,
        name="api_student_attendance",
    ),
    path(
        "api/class/<uuid:class_id>/attendance/",
        views.api_class_attendance,
        name="api_class_attendance",
    ),
]

# Error handlers
handler403 = views.handler403
handler404 = views.handler404
handler500 = views.handler500

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
