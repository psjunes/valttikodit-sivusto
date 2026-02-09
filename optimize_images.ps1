
Add-Type -AssemblyName System.Drawing

function Optimize-Image {
    param (
        [string]$FilePath,
        [int]$MaxWidth = 1920,
        [int]$Quality = 80
    )

    if (-not (Test-Path $FilePath)) {
        Write-Host "File not found: $FilePath" -ForegroundColor Red
        return
    }

    $img = [System.Drawing.Image]::FromFile($FilePath)
    
    # Calculate new dimensions
    $newWidth = $img.Width
    $newHeight = $img.Height

    if ($img.Width -gt $MaxWidth) {
        $ratio = $MaxWidth / $img.Width
        $newWidth = $MaxWidth
        $newHeight = [int]($img.Height * $ratio)
        Write-Host "Resizing $FilePath from $($img.Width)x$($img.Height) to ${newWidth}x${newHeight}" -ForegroundColor Yellow
    }

    # If it's a large PNG (likely photo), convert to JPG
    $ext = [System.IO.Path]::GetExtension($FilePath).ToLower()
    $newPath = $FilePath
    $saveFormat = $img.RawFormat

    if ($ext -eq ".png" -and (Get-Item $FilePath).Length -gt 1MB) {
        # Check if it has transparency - tough in simple script, assume photo-like if huge
        # Convert to JPG
        $newPath = [System.IO.Path]::ChangeExtension($FilePath, ".jpg")
        $saveFormat = [System.Drawing.Imaging.ImageFormat]::Jpeg
        Write-Host "Converting $FilePath to $newPath" -ForegroundColor Cyan
    }

    # Create new bitmap
    $newImg = new-object System.Drawing.Bitmap $newWidth, $newHeight
    $graph = [System.Drawing.Graphics]::FromImage($newImg)
    $graph.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graph.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    
    # Draw logic
    $graph.DrawImage($img, 0, 0, $newWidth, $newHeight)
    
    # Encoder parameters for quality
    $myEncoder = [System.Drawing.Imaging.Encoder]::Quality
    $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter($myEncoder, $Quality)

    # Get JPEG codec
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.FormatID -eq [System.Drawing.Imaging.ImageFormat]::Jpeg.Guid }

    $img.Dispose() # Release original file handle

    if ($saveFormat -eq [System.Drawing.Imaging.ImageFormat]::Jpeg) {
         $newImg.Save($newPath, $codec, $encoderParams)
         if ($newPath -ne $FilePath) {
            Remove-Item $FilePath
            Write-Host "Deleted original $FilePath"
         }
    } else {
         $newImg.Save($newPath) # PNG fallback (no compression param)
    }
    
    $newImg.Dispose()
    $graph.Dispose()
}

# List of files to optimize
$files = @(
    "Tupos_Saunaranta4.png",
    "Tupos_Saunaranta2.png",
    "Tupos_Saunaranta3.png",
    "valtti-contact.png",
    "kaarna_hero_sunny_1769607005303.png",
    "kaarna_hero_forest_1769605587193.png"
)

foreach ($f in $files) {
    Optimize-Image -FilePath $f
}
