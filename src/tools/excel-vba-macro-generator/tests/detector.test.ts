import { describe, expect, test } from "vitest";
import { detect, platformNotes } from "../src/logic/detector";
import { vbaLines } from "../src/logic/vbaText";

const ids = (code: string) => detect(code).map((f) => `${f.line}:${f.id}`).sort();

describe("safety detector (our own code, not the model)", () => {
  test("flags every risky operation named in the brief, with its line", () => {
    const code = [
      'Shell "cmd /c dir", vbHide',
      'Set sh = CreateObject("WScript.Shell")',
      'Kill "C:\\temp\\*.tmp"',
      'RmDir "C:\\temp\\old"',
      'fso.DeleteFile "C:\\a.txt"',
      'Private Declare PtrSafe Function GetTickCount Lib "kernel32" () As Long',
      'URLDownloadToFile 0, "https://x.test/a.exe", "a.exe", 0, 0',
      'Set h = CreateObject("MSXML2.XMLHTTP")',
      "Set w = New WinHttp.WinHttpRequest",
      'sh.RegWrite "HKCU\\Software\\x", 1',
      'SaveSetting "App", "S", "K", "V"',
      'Set wmi = GetObject("winmgmts:\\\\.\\root\\cimv2")',
      'Application.OnTime Now + TimeValue("00:01:00"), "Again"',
      'Workbooks.Open "C:\\other.xlsm"',
      'SendKeys "^s"',
      "Private Sub Workbook_Open()",
      'FileCopy "a.xlsm", Application.StartupPath & "\\a.xlsm"',
    ].join("\n");
    expect(ids(code)).toEqual(
      ["1:shell", "2:wscript-shell", "3:kill", "4:rmdir", "5:fso-delete", "6:declare", "7:url-download", "8:xmlhttp", "9:xmlhttp", "10:registry", "11:savesetting", "12:wmi", "13:ontime", "14:workbooks-open", "15:sendkeys", "16:autorun", "17:startup"].sort(),
    );
    expect(detect(code)[0].severity).toBe("high");
  });

  test("ignores keywords inside comments, Rem lines and string literals", () => {
    const code = ["' Kill all files with Shell and URLDownloadToFile", 'Rem SendKeys "x"', 'MsgBox "Kill Shell RmDir SendKeys"', 'x = 1 \' Kill "a"', 'title = "Workbook_Open"', 'If a Then Rem not a comment here'].join("\n");
    expect(detect(code)).toEqual([]);
  });

  test("a comment continued with _ stays a comment; Kill after a colon is code", () => {
    expect(detect("' first line _\n  Kill everything").length).toBe(0);
    expect(ids('x = 1: Kill "a.txt"')).toEqual(["1:kill"]);
    expect(vbaLines('a = "it\'s" \' c').map((l) => l.code)).toEqual(['a = "    "    ']);
  });

  test("CreateObject flags depend on the class in the string; harmless classes are not flagged", () => {
    expect(ids('Set d = CreateObject("Scripting.Dictionary")')).toEqual([]);
    expect(ids('Set o = CreateObject("Outlook.Application")')).toEqual([]);
    expect(ids('Set x = CreateObject("MSXML2.ServerXMLHTTP.6.0")')).toEqual(["1:xmlhttp"]);
    expect(ids('Workbooks.Add.SaveAs Environ("APPDATA") & "\\Microsoft\\Excel\\XLSTART\\boot.xlsm"')).toEqual(["1:startup"]);
  });
});

describe("Windows vs Mac and 32 vs 64-bit notes", () => {
  test("Declare without PtrSafe and Windows-only objects get notes", () => {
    const notes = platformNotes('Declare Function GetTickCount Lib "kernel32" () As Long\nSet fso = CreateObject("Scripting.FileSystemObject")');
    expect(notes.join(" ")).toMatch(/Line 1: Declare without PtrSafe does not compile in 64-bit Office/);
    expect(notes.join(" ")).toMatch(/do not exist on a Mac/);
    expect(notes.join(" ")).toMatch(/works only on Windows/);
  });
  test("PtrSafe gets the LongPtr note; Mac-only calls are noted; plain code has no notes", () => {
    expect(platformNotes('Private Declare PtrSafe Function F Lib "user32" () As LongPtr').join(" ")).toMatch(/LongPtr/);
    expect(platformNotes('r = AppleScriptTask("s.scpt", "h", "")').join(" ")).toMatch(/only work in Excel for Mac/);
    expect(platformNotes("Sub A()\n  Range(\"A1\").Value = 1\nEnd Sub")).toEqual([]);
  });
});
