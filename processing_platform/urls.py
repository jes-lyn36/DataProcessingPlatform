"""
URL configuration for processing_platform project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView

# Serve the React SPA shell for all non-API, non-admin routes so that
# client-side routing (React Router / direct URL access) works correctly.
spa_view = TemplateView.as_view(template_name="Main.html")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("jobs.urls")),
    # Catch-all: any path not matched above serves the React SPA shell.
    re_path(r"^.*$", spa_view, name="spa"),
]
