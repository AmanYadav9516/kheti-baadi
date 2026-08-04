$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8080/")
$listener.Start()
Write-Host "Kheti-Baadi Server running at http://localhost:8080/"

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $relPath = $context.Request.Url.LocalPath.TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($relPath)) { $relPath = "index.html" }
    $filePath = Join-Path "c:\KISAAN" $relPath
    
    if (Test-Path $filePath) {
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $ext = [System.IO.Path]::GetExtension($filePath)
        if ($ext -eq ".css") { $context.Response.ContentType = "text/css" }
        elseif ($ext -eq ".js") { $context.Response.ContentType = "application/javascript" }
        elseif ($ext -eq ".html") { $context.Response.ContentType = "text/html; charset=utf-8" }
        $context.Response.ContentLength64 = $bytes.Length
        $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    $context.Response.Close()
}
