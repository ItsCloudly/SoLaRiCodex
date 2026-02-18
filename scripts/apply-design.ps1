param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('helios-prism', 'atlas-editorial')]
  [string]$Design
)

$root = Split-Path -Parent $PSScriptRoot

switch ($Design) {
  'helios-prism' { $source = Join-Path $root 'design-overhauls/01-helios-prism/src' }
  'atlas-editorial' { $source = Join-Path $root 'design-overhauls/02-atlas-editorial/src' }
}

Copy-Item (Join-Path $source 'components/layout/MainLayout.tsx') (Join-Path $root 'src/components/layout/MainLayout.tsx') -Force
Copy-Item (Join-Path $source 'styles/global.css') (Join-Path $root 'src/styles/global.css') -Force
Copy-Item (Join-Path $source 'styles/components.css') (Join-Path $root 'src/styles/components.css') -Force
Copy-Item (Join-Path $source 'styles/layout.css') (Join-Path $root 'src/styles/layout.css') -Force

Write-Output "Applied design: $Design"
