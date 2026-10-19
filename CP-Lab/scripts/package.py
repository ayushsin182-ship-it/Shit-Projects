#!/usr/bin/env python3
"""Build a standard VSIX (OPC ZIP) using the Python standard library."""
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from xml.etree import ElementTree as ET

root = Path(__file__).resolve().parents[1]
source = root / 'vscode'
package = json.loads((source / 'package.json').read_text())
version = package['version']
manifest = f'''<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="cp-lab" Version="{version}" Publisher="cplab" />
    <DisplayName>CP Lab — Local Competitive Programming</DisplayName>
    <Description xml:space="preserve">Import, test and submit competitive programming solutions from VS Code.</Description>
    <Tags>competitive-programming,education</Tags><Categories>Other</Categories><GalleryFlags>Public</GalleryFlags>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="^1.85.0" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value="" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value="" />
      <Property Id="Microsoft.VisualStudio.Code.LocalizedLanguages" Value="" />
      <Property Id="Microsoft.VisualStudio.Code.ExecutesCode" Value="true" />
    </Properties>
    <License>extension/LICENSE</License>
  </Metadata>
  <Installation><InstallationTarget Id="Microsoft.VisualStudio.Code" /></Installation>
  <Dependencies />
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.License" Path="extension/LICENSE" Addressable="true" />
  </Assets>
</PackageManifest>'''
content_types = '''<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="json" ContentType="application/json" />
  <Default Extension="js" ContentType="application/javascript" />
  <Default Extension="md" ContentType="text/markdown" />
  <Default Extension="vsixmanifest" ContentType="text/xml" />
  <Override PartName="/extension/LICENSE" ContentType="text/plain" />
</Types>'''
ET.fromstring(manifest)
ET.fromstring(content_types)
out = root / f'cp-lab-{version}.vsix'
with ZipFile(out, 'w', ZIP_DEFLATED) as archive:
    archive.writestr('extension.vsixmanifest', manifest)
    archive.writestr('[Content_Types].xml', content_types)
    for item in sorted(source.rglob('*')):
        if item.is_file() and '__pycache__' not in item.parts:
            archive.write(item, 'extension/' + item.relative_to(source).as_posix())
with ZipFile(out) as archive:
    assert archive.testzip() is None
    for required in ('extension/package.json','extension/extension.js','extension/lib/runner.js'):
        assert required in archive.namelist(), required
print(out)
