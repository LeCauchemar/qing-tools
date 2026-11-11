Add-Type -AssemblyName System.Windows.Forms
$img = [System.Windows.Forms.Clipboard]::GetImage()
if ($img) {
  "clipboard image: $($img.Width)x$($img.Height)"
  $img.Dispose()
} else {
  "clipboard image: none"
}
