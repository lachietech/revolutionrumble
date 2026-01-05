# PowerShell script to split admin.html into three separate pages
$adminFile = "c:\Users\lniel\OneDrive\BUSINESS\revolution rumble\frontend\admin.html"
$content = Get-Content $adminFile -Raw

# Extract nav bar
$navBar = @'
<div id="admin-nav" style="background:#141a22;border-bottom:1px solid rgba(255,255,255,.08);padding:12px 0;margin-bottom:24px">
    <div style="max-width:1200px;margin:0 auto;padding:0 20px;display:flex;gap:16px;align-items:center">
        <a href="admin-tournaments.html" id="nav-tournaments" style="padding:8px 16px;border-radius:6px;text-decoration:none;color:#b9c6d8;transition:all .2s">🏆 Tournaments</a>
        <a href="admin-registrations.html" id="nav-registrations" style="padding:8px 16px;border-radius:6px;text-decoration:none;color:#b9c6d8;transition:all .2s">📋 Registrations</a>
        <a href="admin-results.html" id="nav-results" style="padding:8px 16px;border-radius:6px;text-decoration:none;color:#b9c6d8;transition:all .2s">🎯 Scores</a>
        <div style="margin-left:auto"><a href="index.html" style="padding:8px 16px;text-decoration:none;color:#b9c6d8">← Back to Site</a></div>
    </div>
</div>
<style>
#admin-nav a:hover{background:rgba(59,130,246,.1);color:var(--blue-500)}
#admin-nav a.active{background:#3b82f6;color:white}
</style>
'@

Write-Output "Admin pages will be split manually using file operations..."
Write-Output "Navigation bar template created"
Write-Output "Please use the file creation tools to build each page"
