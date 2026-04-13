# Script untuk mengganti logo image dengan text-based logo di semua HTML files

$WorkspaceRoot = "c:\KULIAH\MAGANG\Magang di Perhutani\Lensa Bandung"
$htmlFiles = Get-ChildItem -Path $WorkspaceRoot -Recurse -Include "*.html" -File

$textBasedLogo = @"
<span style="font-weight: 700; color: #14532D; font-size: 24px; letter-spacing: -0.5px;">LENSA<span style="color: #1F3F5F; font-weight: 400; font-size: 18px; margin-left: 2px;">BANDUNG</span></span>
"@

$replaceCount = 0

foreach ($file in $htmlFiles) {
    try {
        $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
        $originalContent = $content
        
        # Replace image-based logo with text-based logo in navbar-brand
        # Pattern 1: <img src="img/news-800x500-1.jpg" ...> inside navbar-brand
        $pattern1 = '<img src="img/news-800x500-1\.jpg"[^>]*>'
        $pattern2 = '<img[^>]*src="img/news-800x500-1\.jpg"[^>]*>'
        
        $newContent = $content -replace $pattern1, $textBasedLogo
        $newContent = $newContent -replace $pattern2, $textBasedLogo
        
        # Also replace src="../img/news-800x500-1.jpg" for articles
        $pattern3 = '<img[^>]*src="\.\.\/img\/news-800x500-1\.jpg"[^>]*>'
        $newContent = $newContent -replace $pattern3, $textBasedLogo
        
        if ($newContent -ne $content) {
            Set-Content -Path $file.FullName -Value $newContent -Encoding UTF8 -NoNewline
            $replaceCount++
            Write-Host "Updated logo in: $($file.Name)"
        }
    } catch {
        Write-Host "Error processing $($file.FullName): $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Logo replacement complete!"
Write-Host "Total files updated: $replaceCount"
