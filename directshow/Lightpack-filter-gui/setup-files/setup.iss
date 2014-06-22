#define MyAppName "Lightpack Filter"
#define MyAppVersion "0.5"
#define MyAppPublisher "Matthew Ng"
#define MyAppURL "https://github.com/matthewn4444/Lightpack-Filter-and-API/"
#define LaunchProgram "Edit Lightpack settings"
#define CreateDesktopIcon "Create a &desktop icon"

[Setup]
AppId={{8a45a937-5e18-4c5c-9894-d1b744bf126a}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={pf}\{#MyAppName}
DefaultGroupName={#MyAppName}
Compression=lzma
SolidCompression=yes
OutputDir=.
OutputBaseFilename=setup
AppMutex=LightpackFilterMutex,Global/LightpackFilterMutex

[Files]
Source: "*"; Excludes: ".git,setup.iss,*.lnk,*.exp,setting.ini,Test.*,*.pdb,*.node,*.lib" ; DestDir: "{app}"; Flags: ignoreversion recursesubdirs
Source: "icon.ico"; DestDir: "{app}"; DestName: "icon.ico"; Flags: ignoreversion

[Tasks]
Name: "desktopicon"; Description: "{#CreateDesktopIcon}"

[Icons]
Name: "{group}\Lightpack Filter"; Filename: "{app}\nw.exe"; WorkingDir: "{app}"; IconFilename: "{app}/icon.ico"
Name: "{userdesktop}\Lightpack Filter"; Filename: "{app}\nw.exe"; WorkingDir: "{app}"; IconFilename: "{app}/icon.ico"; Tasks: desktopicon
     
[Run]
Filename: "{app}\installFilter.bat"; Flags: skipifdoesntexist
Filename: https://github.com/matthewn4444/Lightpack-Filter-and-API/wiki/Usage; Description: "Read Usage (Website)"; Flags: postinstall shellexec
Filename: "{app}\nw.exe"; WorkingDir: "{app}"; Description: {#LaunchProgram}; Flags: postinstall shellexec skipifdoesntexist

Filename: "{app}\uninstallFilter.bat"; Flags: skipifdoesntexist