import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  Square,
  Upload,
  Sparkles,
  Printer,
  Trash2,
  Undo2,
  FileText,
  User,
  Clock,
  MapPin,
  Activity,
  Check,
  AlertCircle,
  HelpCircle,
  Loader2,
  Save,
  CheckSquare,
  RefreshCw,
  Plus,
  ArrowRight,
  Database
} from "lucide-react";
import { MeetingMinutes, Attendee, GenerationResponse } from "./types";

// Helper to get Japanese Imperial Calendar (Reiwa) from Gregorian Year
const getReiwaYearString = (dateStr: string): { year: string; month: string; day: string } => {
  if (!dateStr) return { year: "  ", month: "  ", day: "  " };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { year: "  ", month: "  ", day: "  " };
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1);
  const day = String(d.getDate());
  
  // Reiwa started in 2019 (2019 is Reiwa 1)
  const reiwaYear = year - 2018;
  const yearDisplay = reiwaYear > 0 ? `令和${reiwaYear}` : `${year}`;
  
  return {
    year: yearDisplay,
    month,
    day
  };
};

// Helper to check if attendee's affiliation corresponds to the user or family
const isUserOrFamily = (aff: string): boolean => {
  if (!aff) return false;
  return aff.includes("利用者") || aff.includes("家族");
};

const CARE_LEVELS = [
  "未指定",
  "自立",
  "要支援　１",
  "要支援　２",
  "要介護　１",
  "要介護　２",
  "要介護　３",
  "要介護　４",
  "要介護　５"
];

const DEFAULT_AGENCY_LIST = [
  { agency: "桃の郷 居宅介護支援事業所", cm: "鈴木 一郎" },
  { agency: "ひまわりケア 居宅介護支援事業所", cm: "佐藤 恵美" },
  { agency: "あおぞら 居宅介護支援事業所", cm: "高橋 洋介" },
  { agency: "みどり 居宅介護支援事業所", cm: "田中 美沙" }
];

const PREVIEW_FONT_FAMILY = '"HGP Gothic M", "HGPｺﾞｼｯｸM", "HG Gothic M", "Meiryo UI", sans-serif';
const PREVIEW_FONT_STYLE = { fontFamily: PREVIEW_FONT_FAMILY };

const CONTENT_FONT_FAMILY = '"UD Digi Kyokasho NK-R", "UD デジタル 教科書体 NK", sans-serif';
const CONTENT_FONT_STYLE = { fontFamily: CONTENT_FONT_FAMILY };

const getDynamicFontSize = (text: string, isAffiliation = false): string => {
  if (!text) return isAffiliation ? "10px" : "11px";
  const lines = text.split('\n');
  const maxLen = Math.max(...lines.map(l => l.length));
  if (isAffiliation) {
    if (maxLen <= 4) return "11px";
    if (maxLen <= 8) return "10px";
    if (maxLen <= 12) return "10px"; // Make 9-12 look 10px instead of 9px to improve readability
    if (maxLen <= 16) return "9px";
    return "8px";
  } else {
    // Names
    if (maxLen <= 4) return "12px"; // Short names/headings like "氏名" look slightly larger
    if (maxLen <= 6) return "11px";
    if (maxLen <= 10) return "10px";
    return "9px";
  }
};

const isLikelyCmName = (text: string): boolean => {
  if (!text) return false;
  const trimmed = text.trim();
  // Filter out pure numbers (like spreadsheet indices or IDs)
  if (/^\d+$/.test(trimmed)) return false;
  // Filter out phone numbers (contains hyphens and numbers)
  if (/^[0-9\-\(\)\s+]+$/.test(trimmed) && trimmed.length >= 8) return false;
  // Filter out email addresses
  if (trimmed.includes("@")) return false;
  // Filter out postal codes or long addresses
  if (trimmed.includes("〒") || trimmed.length > 10) return false;
  // Filter out empty strings
  if (!trimmed) return false;
  return true;
};

const isGenericAgency = (val: string): boolean => {
  const genericTerms = [
    "居宅介護支援",
    "居宅介護支援事業所",
    "ケアプランセンター",
    "介護支援",
    "介護支援事業所",
    "居宅支援",
    "居宅介護",
    "居宅",
    "特定施設",
    "訪問介護",
    "通所介護",
    "地域密着型",
    "小規模多機能",
    "相談支援",
    "相談支援事業所",
    "介護プラン",
    "ケアプラン",
    "介護サービス"
  ];
  const cleaned = val.trim();
  return genericTerms.some(term => cleaned === term || cleaned === term + "名" || cleaned === "（" + term + "）" || cleaned === "(" + term + ")");
};

const extractAgencyAndCm = (parts: string[]): { agency: string; cm: string } => {
  if (parts.length === 0) return { agency: "", cm: "" };
  if (parts.length === 1) return { agency: parts[0], cm: "" };
  
  const agencyKeywords = ["居宅", "介護", "支援", "ケア", "事業所", "ステーション", "ライフ", "福祉", "相談", "ヘルパー", "デイ", "サービス", "プラン", "センター", "桃の郷"];
  const agencyIdx = parts.findIndex(p => agencyKeywords.some(kw => p.includes(kw)));
  
  let agency = "";
  let cm = "";
  
  if (agencyIdx !== -1) {
    const rawAgency = parts[agencyIdx];
    
    // Check if it's a generic term and we have other parts we can combine with
    if (isGenericAgency(rawAgency) && parts.length >= 3) {
      if (agencyIdx + 1 < parts.length) {
        agency = rawAgency + " " + parts[agencyIdx + 1];
        const rest = parts.filter((_, idx) => idx !== agencyIdx && idx !== (agencyIdx + 1));
        const likelyCm = rest.find(isLikelyCmName);
        cm = likelyCm || rest[0] || "";
      } else if (agencyIdx - 1 >= 0) {
        agency = parts[agencyIdx - 1] + " " + rawAgency;
        const rest = parts.filter((_, idx) => idx !== agencyIdx && idx !== (agencyIdx - 1));
        const likelyCm = rest.find(isLikelyCmName);
        cm = likelyCm || rest[0] || "";
      } else {
        agency = rawAgency;
        const rest = parts.filter((_, idx) => idx !== agencyIdx);
        const likelyCm = rest.find(isLikelyCmName);
        cm = likelyCm || rest[0] || "";
      }
    } else {
      agency = rawAgency;
      const rest = parts.filter((_, idx) => idx !== agencyIdx);
      const likelyCm = rest.find(isLikelyCmName);
      cm = likelyCm || rest[0] || "";
    }
  } else {
    // If no explicit agency keyword found, look for the longest part as agency, and the rest as cm
    const sortedParts = [...parts].sort((a, b) => b.length - a.length);
    agency = sortedParts[0];
    const rest = parts.filter(p => p !== agency);
    const likelyCm = rest.find(isLikelyCmName);
    cm = likelyCm || rest[0] || "";
  }
  
  return { agency, cm };
};

const parseExcelList = (text: string) => {
  const lines = text.split(/\r?\n/);
  const result: { agency: string; cm: string }[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    let agency = "";
    let cm = "";
    
    // 1. If it contains a Tab, it's a standard Excel copy-paste row
    if (trimmed.includes("\t")) {
      const parts = trimmed.split("\t").map(p => p.trim()).filter(Boolean);
      const extracted = extractAgencyAndCm(parts);
      agency = extracted.agency;
      cm = extracted.cm;
    } 
    // 2. If it contains comma or full-width comma
    else if (trimmed.includes(",") || trimmed.includes("，")) {
      const separator = trimmed.includes(",") ? "," : "，";
      const parts = trimmed.split(separator).map(p => p.trim()).filter(Boolean);
      const extracted = extractAgencyAndCm(parts);
      agency = extracted.agency;
      cm = extracted.cm;
    }
    // 3. Otherwise, it might be space-separated (full-width or half-width spaces)
    else {
      const parts = trimmed.split(/[\s　]+/).map(p => p.trim()).filter(Boolean);
      const extracted = extractAgencyAndCm(parts);
      agency = extracted.agency;
      cm = extracted.cm;
    }
    
    // Clean up surrounding quotes
    if (agency) {
      agency = agency.replace(/^["']|["']$/g, "").trim();
    }
    if (cm) {
      cm = cm.replace(/^["']|["']$/g, "").trim();
    }
    
    // Skip if it's a header line
    if (
      agency && (agency.includes("事業所名") || agency.includes("居宅") || agency === "事業所" || agency === "名称") &&
      cm && (cm.includes("ケアマネ") || cm.includes("担当") || cm.includes("氏名") || cm.includes("CM"))
    ) {
      continue;
    }
    
    if (agency) {
      result.push({ agency, cm });
    }
  }
  
  return result;
};

const normalizeCareLevel = (val: string): string => {
  if (!val) return "未指定";
  const cl = val.trim();
  if (cl.includes("支援1") || cl.includes("支援１")) return "要支援　１";
  if (cl.includes("支援2") || cl.includes("支援２")) return "要支援　２";
  if (cl.includes("介護1") || cl.includes("介護１")) return "要介護　１";
  if (cl.includes("介護2") || cl.includes("介護２")) return "要介護　２";
  if (cl.includes("介護3") || cl.includes("介護３")) return "要介護　３";
  if (cl.includes("介護4") || cl.includes("介護４")) return "要介護　４";
  if (cl.includes("介護5") || cl.includes("介護５")) return "要介護　５";
  if (cl.includes("自立")) return "自立";
  return cl;
};

const PRESET_AFFILIATIONS = [
  "ご利用者様",
  "利用者ご家族",
  "福祉用具",
  "その他事業所",
  "ヘルパーステーション桃の郷\n京都東山",
  "デイサービス桃の郷\n京都東山",
  "その他"
];

const INITIAL_ATTENDEES: Attendee[] = [
  { id: "1", name: "", affiliation: "ご利用者様" },
  { id: "2", name: "", affiliation: "利用者ご家族" },
  { id: "3", name: "", affiliation: "" },
  { id: "4", name: "", affiliation: "ヘルパーステーション桃の郷\n京都東山" },
  { id: "5", name: "", affiliation: "デイサービス桃の郷\n京都東山" },
  { id: "6", name: "", affiliation: "福祉用具" },
  { id: "7", name: "", affiliation: "" },
  { id: "8", name: "", affiliation: "" }
];

const DEFAULT_MINUTES: MeetingMinutes = {
  reportDate: new Date().toISOString().split("T")[0],
  officeName: "ヘルパーステーション桃の郷　京都東山",
  reporterName: "",
  clientName: "",
  careLevel: "",
  location: "",
  date: new Date().toISOString().split("T")[0],
  startTime: "",
  endTime: "",
  attendees: INITIAL_ATTENDEES,
  discussedItems: "",
  discussionContent: "",
  conclusion: "",
  remainingIssues: "",
  nextMeeting: "次回更新時",
  homeCareAgency: ""
};

const DEMO_MINUTES: MeetingMinutes = {
  reportDate: "2026-07-17",
  officeName: "ヘルパーステーション桃の郷　京都東山",
  reporterName: "山田 太郎",
  clientName: "桃野 太郎",
  careLevel: "要介護　２",
  location: "桃の郷 京都東山",
  date: "2026-07-17",
  startTime: "13:30",
  endTime: "14:15",
  attendees: [
    { id: "1", name: "桃野 太郎", affiliation: "ご利用者様" },
    { id: "2", name: "桃野 花子", affiliation: "利用者ご家族" },
    { id: "3", name: "鈴木 一郎", affiliation: "桃の郷 居宅介護支援事業所" },
    { id: "4", name: "山田 太郎", affiliation: "ヘルパーステーション桃の郷\n京都東山" },
    { id: "5", name: "佐藤 美咲", affiliation: "デイサービス桃の郷\n京都東山" },
    { id: "6", name: "高橋 健二", affiliation: "福祉用具" },
    { id: "7", name: "", affiliation: "" },
    { id: "8", name: "", affiliation: "" }
  ],
  discussedItems: "・入浴介助時における安全確保について\n・移乗時のふらつき対策と歩行器の選定",
  discussionContent: "【家族の意向】\n最近自宅の風呂での立ち上がり時にふらつくことが増え、ヒヤリとすることが多くなった。本人はお風呂が好きなので安全に自宅で入浴させてあげたいが、家族だけでは不安がある。\n\n【ヘルパー（HS 桃の郷）の提案】\n週2回の訪問介護の際、入浴介助を重点的に行い、浴室内の移動や浴槽のまたぎ動作を安全にサポートできる体制を整えたい。また、浴槽内に滑り止めマットがないため、福祉用具での導入を勧めたい。\n\n【福祉用具の提案】\n浴室内での転倒予防のため、浴槽内滑り止めマットと、洗い場からまたぎ際のサポートとなる入浴台（バスボード）のレンタル、および浴室用手すりの設置を提案。\n\n【デイサービスの報告】\nデイサービスでも週1回入浴を行っているが、看護師管理のもと特に問題なく動作できている。ただ、送迎時に車内への乗り込み of 際も少しふらつきが見られるため注意を払っている。",
  conclusion: "・訪問介護（ヘルパー）の入浴介助を週2回で継続し、滑り止めマットとバスボードを活用して安全な移動動作を確立する。\n・デイサービスの入浴は週1回とし、送迎・移乗時のふらつきにはスタッフが必ずマンツーマンで付き添う。\n・浴室内の住宅改修（手すり設置）については、ケアマネジャー主導で週明けに申請手続きを開始する。",
  remainingIssues: "・浴室用手すりの取り付け位置について、本人の身体状況を考慮しながら再度住宅改修専門業者と現地で打ち合わせ（来週水曜日を予定）。\n・デイサービスを現在の週2回から週3回に増回するプランについては、月内の利用限度額の枠内をケアマネジャーが計算し、追ってご家族に連絡する。",
  nextMeeting: "次回更新時（3ヶ月後）",
  homeCareAgency: "桃の郷 居宅介護支援事業所"
};

// Custom auto-resizing textarea to dynamically fit content
interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
}

const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ value, className, style, ...props }, ref) => {
    const localRef = React.useRef<HTMLTextAreaElement | null>(null);

    React.useEffect(() => {
      const textarea = localRef.current;
      if (textarea) {
        textarea.style.height = "auto";
        const minH = style?.minHeight ? parseInt(String(style.minHeight)) : 0;
        textarea.style.height = `${Math.max(textarea.scrollHeight, minH)}px`;
      }
    }, [value, style?.minHeight]);

    return (
      <textarea
        {...props}
        ref={(node) => {
          localRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        value={value}
        className={`${className} resize-none overflow-hidden`}
        style={{ ...style }}
      />
    );
  }
);
AutoResizeTextarea.displayName = "AutoResizeTextarea";

export default function App() {
  // Main form states
  const [minutes, setMinutes] = useState<MeetingMinutes>(() => {
    const saved = localStorage.getItem("service_minutes_draft");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure attendees array always has 8 items
        if (parsed.attendees && parsed.attendees.length < 8) {
          const filled = [...parsed.attendees];
          while (filled.length < 8) {
            filled.push({ id: String(filled.length + 1), name: "", affiliation: "" });
          }
          parsed.attendees = filled;
        }
        return parsed;
      } catch (e) {
        return DEFAULT_MINUTES;
      }
    }
    return DEFAULT_MINUTES;
  });

  // UI state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  
  // Custom manual transcript/notes
  const [textNotes, setTextNotes] = useState("");

  // 居宅介護支援事業所リスト states
  const [agencyList, setAgencyList] = useState<{ agency: string; cm: string }[]>(() => {
    const saved = localStorage.getItem("care_record_agency_list");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return DEFAULT_AGENCY_LIST;
  });

  const [rawAgencyText, setRawAgencyText] = useState(() => {
    const saved = localStorage.getItem("care_record_agency_list_raw");
    if (saved) return saved;
    return DEFAULT_AGENCY_LIST.map(item => `${item.agency}\t${item.cm}`).join("\n");
  });

  const [isDragging, setIsDragging] = useState(false);

  const handleUpdateAgencies = () => {
    const parsed = parseExcelList(rawAgencyText);
    if (parsed.length === 0) {
      alert("正しい形式で入力してください。（居宅名とケアマネ名をタブやスペース、カンマ等で区切ってください）");
      return;
    }
    setAgencyList(parsed);
    localStorage.setItem("care_record_agency_list", JSON.stringify(parsed));
    localStorage.setItem("care_record_agency_list_raw", rawAgencyText);
    alert(`居宅リストを更新しました（${parsed.length}件）`);
  };

  const handleAgencyChange = (val: string) => {
    const match = agencyList.find(item => item.agency === val);
    if (match) {
      let updated = false;
      const updatedAttendees = minutes.attendees.map((att, idx) => {
        if (att.affiliation === val || (idx === 2 && !att.affiliation)) {
          updated = true;
          return { ...att, name: match.cm, affiliation: val };
        }
        return att;
      });

      if (!updated) {
        if (!updatedAttendees[2].name) {
          updatedAttendees[2].name = match.cm;
          updatedAttendees[2].affiliation = val;
        } else {
          const firstEmptyIdx = updatedAttendees.findIndex(att => !att.name && !att.affiliation);
          if (firstEmptyIdx !== -1) {
            updatedAttendees[firstEmptyIdx].name = match.cm;
            updatedAttendees[firstEmptyIdx].affiliation = val;
          }
        }
      }

      setMinutes(prev => ({
        ...prev,
        homeCareAgency: val,
        attendees: updatedAttendees
      }));
    } else {
      handleMetaChange("homeCareAgency", val);
    }
  };

  // Generation status state
  const [isLoading, setIsLoading] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSavedToast, setShowSavedToast] = useState(false);

  // Audio recording references
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto save to local storage
  useEffect(() => {
    localStorage.setItem("service_minutes_draft", JSON.stringify(minutes));
  }, [minutes]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Duration display helper (00:00)
  const formatDuration = (sec: number) => {
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  // Recording Controls
  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      setErrorMsg(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let mimeType = "";
      if (MediaRecorder.isTypeSupported("audio/webm")) mimeType = "audio/webm";
      else if (MediaRecorder.isTypeSupported("audio/mp4")) mimeType = "audio/mp4";
      else if (MediaRecorder.isTypeSupported("audio/ogg")) mimeType = "audio/ogg";
      else if (MediaRecorder.isTypeSupported("audio/wav")) mimeType = "audio/wav";
      
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalBlob = new Blob(audioChunksRef.current, { type: mimeType || "audio/webm" });
        setAudioBlob(finalBlob);
        setAudioUrl(URL.createObjectURL(finalBlob));
        setUploadedFileName(null); // Clear uploaded file if we record a new one
        
        // Stop microphone stream tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250); // Slice every 250ms
      setIsRecording(true);
      setRecordingDuration(0);
      
      timerRef.current = window.setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Microphone access failed", err);
      setErrorMsg("マイクへのアクセスに失敗しました。ブラウザのマイク権限を許可し、HTTPS接続（またはローカルホスト）であることを確認してください。携帯電話（iOS/Android）のブラウザでもマイク使用のポップアップが表示されるので、許可を押してください。");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // Handle local file upload (Android / iPhone recorded audios)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setErrorMsg(null);
      setAudioBlob(file);
      setAudioUrl(URL.createObjectURL(file));
      setUploadedFileName(file.name);
    }
  };

  // Convert blob to base64 helper
  const fileToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          const base64String = reader.result.split(",")[1];
          resolve(base64String);
        } else {
          reject(new Error("ファイルの読み込みに失敗しました。"));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  };

  // Trigger Gemini AI generation
  const handleGenerateMinutes = async () => {
    let currentNotes = textNotes;
    let isFallback = false;

    if (!audioBlob && !currentNotes.trim()) {
      isFallback = true;
      currentNotes = `・佐藤 恵美子 様（要介護2）のサービス担当者会議。
・夜間帯の排泄時における転倒リスクの軽減について検討。
・最近、夜間にトイレに起きた際のふらつきが強くなっている。
・ベッド脇へのポータブルトイレ設置を提案。本本人（佐藤様）は「まだ歩ける」と消極的だが、ご家族は設置を希望。
・入浴介助の不足を補うため、ヘルパー派遣を週3回に増やすことを検討。
・寝室からトイレまでの動線にセンサーライトを仮設置し、1週間経過を観察する。`;
      setTextNotes(currentNotes);
    }

    setIsLoading(true);
    setErrorMsg(null);
    setGenerationStep("音声データの解析準備中...");

    try {
      let audioBase64 = "";
      let mimeType = "";

      if (audioBlob) {
        setGenerationStep("音声をシステム用データに変換中（Base64変換）...");
        audioBase64 = await fileToBase64(audioBlob);
        mimeType = audioBlob.type || "audio/webm";
      }

      setGenerationStep("Gemini 3.5 AIで会議要約＆フォーマット抽出中（数秒〜十数秒かかります）...");

      const response = await fetch("/api/generate-minutes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64,
          mimeType,
          textNotes: currentNotes,
          clientName: minutes.clientName,
          careLevel: minutes.careLevel,
          date: minutes.date,
          location: minutes.location,
          attendees: minutes.attendees.filter(a => a.name.trim() || a.affiliation.trim())
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "サーバーからの返答が異常です。");
      }

      const data: GenerationResponse = await response.json();

      setGenerationStep("議事録フォーマットへ適用・自動調整中...");

      // Update state with generated contents
      setMinutes(prev => {
        // Prepare suggested metadata if returned by AI and was previously blank
        const updated = { ...prev };
        updated.discussedItems = data.discussedItems || "";
        updated.discussionContent = data.discussionContent || "";
        updated.conclusion = data.conclusion || "";
        updated.remainingIssues = data.remainingIssues || "";
        updated.nextMeeting = data.nextMeeting || prev.nextMeeting;

        if (data.suggestedClientName && !prev.clientName) {
          updated.clientName = data.suggestedClientName;
        }
        if (data.suggestedCareLevel && prev.careLevel === "未指定") {
          updated.careLevel = data.suggestedCareLevel;
        }
        if (data.suggestedDate && prev.date === new Date().toISOString().split("T")[0]) {
          updated.date = data.suggestedDate;
        }
        if (data.suggestedLocation && prev.location === "桃の郷 京都東山") {
          updated.location = data.suggestedLocation;
        }

        // Try to prefill attendee names if they match by role
        if (data.suggestedClientName) {
          const clientAttendeeIndex = updated.attendees.findIndex(a => a.affiliation === "利用者様");
          if (clientAttendeeIndex !== -1 && !updated.attendees[clientAttendeeIndex].name) {
            updated.attendees[clientAttendeeIndex].name = data.suggestedClientName;
          }
        }

        return updated;
      });

      if (data.apiFallbackUsed) {
        setErrorMsg("【お知らせ】現在AIの利用が集中しているため、安全なローカル要約機能に切り替えました。プレビュー内のテキストはクリックして直接編集が可能です。");
      } else if (isFallback || data.fallbackUsed) {
        setErrorMsg("【デモ自動生成】会議メモが空だったため、サンプルの会議メモ（佐藤様・要介護2）を自動挿入して要約議事録を作成しました。実際の会議では、音声の録音または手動メモを入力してください。");
      } else {
        setErrorMsg(null);
      }

      setGenerationStep("");
      setIsLoading(false);
      
      // Flash a quick success message or scroll down to view
      const previewEl = document.getElementById("a4-preview-card");
      if (previewEl) {
        previewEl.scrollIntoView({ behavior: "smooth" });
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`AI議事録作成に失敗しました: ${err.message || "通信エラー"}`);
      setIsLoading(false);
      setGenerationStep("");
    }
  };

  // Helper to format Japanese weekday
  const getJapaneseWeekday = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    return weekdays[date.getDay()];
  };

  // Form field state triggers
  const handleMetaChange = (key: keyof MeetingMinutes, value: any) => {
    setMinutes(prev => {
      const updated = { ...prev, [key]: value };
      
      // Sync clientName to first attendee index 0 (利用者様)
      if (key === "clientName") {
        const updatedAttendees = [...updated.attendees];
        if (updatedAttendees.length > 0) {
          updatedAttendees[0].name = value;
          updatedAttendees[0].affiliation = "利用者様";
        }
        updated.attendees = updatedAttendees;
      }
      return updated;
    });
  };

  const handleAttendeeChange = (index: number, key: keyof Attendee, value: string) => {
    setMinutes(prev => {
      const updatedAttendees = [...prev.attendees];
      let updatedHomeCareAgency = prev.homeCareAgency;

      updatedAttendees[index] = {
        ...updatedAttendees[index],
        [key]: value
      };

      // Auto-lookup agency when CM name is entered in any attendee name slot
      if (key === "name" && value) {
        const cleanedValue = value.trim().replace(/[\s　]+/g, "");
        if (cleanedValue.length >= 2) {
          const match = agencyList.find(item => {
            if (!item.cm) return false;
            const cleanedCm = item.cm.trim().replace(/[\s　]+/g, "");
            return cleanedCm === cleanedValue || cleanedCm.includes(cleanedValue) || cleanedValue.includes(cleanedCm);
          });

          if (match) {
            updatedAttendees[index].affiliation = match.agency;
            updatedHomeCareAgency = match.agency;
          }
        }
      }
      
      const updated = {
        ...prev,
        attendees: updatedAttendees,
        homeCareAgency: updatedHomeCareAgency
      };

      // Sync index 0 (利用者様) attendee name back to clientName
      if (index === 0) {
        updated.clientName = value;
        updatedAttendees[0].affiliation = "ご利用者様";
      } else if (key === "name" && (updatedAttendees[index].affiliation === "ご利用者様" || updatedAttendees[index].affiliation === "利用者様")) {
        // Fallback sync for any other attendee with affiliation "利用者様"
        updated.clientName = value;
      }
      
      return updated;
    });
  };

  // Demo loading
  const loadDemoData = () => {
    if (confirm("現在入力されている内容をリセットして、デモ用のサービス担当者会議データを読み込みますか？")) {
      setMinutes(DEMO_MINUTES);
      setTextNotes("※デモデータ読み込み完了。右側のプレビューに、美しくA4サイズにまとまった議事録が生成されています。");
      setErrorMsg(null);
    }
  };

  // Reset function
  const resetToDefault = () => {
    if (confirm("すべての入力内容と生成結果をリセットして、新しく作成しますか？")) {
      setMinutes({
        ...DEFAULT_MINUTES,
        reportDate: new Date().toISOString().split("T")[0],
        date: new Date().toISOString().split("T")[0],
        attendees: [
          { id: "1", name: "", affiliation: "ご利用者様" },
          { id: "2", name: "", affiliation: "利用者ご家族" },
          { id: "3", name: "", affiliation: "" },
          { id: "4", name: "", affiliation: "ヘルパーステーション桃の郷\n京都東山" },
          { id: "5", name: "", affiliation: "デイサービス桃の郷\n京都東山" },
          { id: "6", name: "", affiliation: "福祉用具" },
          { id: "7", name: "", affiliation: "" },
          { id: "8", name: "", affiliation: "" }
        ],
        homeCareAgency: ""
      });
      setTextNotes("");
      setAudioBlob(null);
      setAudioUrl(null);
      setUploadedFileName(null);
      setErrorMsg(null);
    }
  };

  // Explicit Save Indicator
  const manualSaveDraft = () => {
    localStorage.setItem("service_minutes_draft", JSON.stringify(minutes));
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 2000);
  };

  // Print trigger
  const handlePrint = () => {
    window.print();
  };

  const repDateJapanese = getReiwaYearString(minutes.reportDate);
  const meetDateJapanese = getReiwaYearString(minutes.date);

  return (
    <div id="app-root" className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      {/* HEADER BAR */}
      <header className="no-print bg-blue-900 text-white border-b border-blue-800 sticky top-0 z-40 px-6 py-3.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-500 rounded flex items-center justify-center shrink-0 shadow-inner">
              <CheckSquare className="w-5 h-5 text-white" id="app-icon" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">
                サービス担当者会議議事録管理
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={loadDemoData}
              className="px-3 py-1.5 text-xs font-bold text-emerald-100 bg-emerald-800/80 hover:bg-emerald-800 rounded border border-emerald-700 transition flex items-center gap-1 cursor-pointer shadow-xs"
              title="A4フォーマットの出来栄えを確認するためのサンプルデータを読み込みます"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} />
              デモデータ
            </button>
            <button
              onClick={resetToDefault}
              className="px-3 py-1.5 text-xs font-bold text-slate-100 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              新規
            </button>
            <button
              onClick={manualSaveDraft}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded transition flex items-center gap-1 shadow-md border border-blue-500 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              保存
            </button>
          </div>
        </div>
      </header>

      {/* WORKSPACE CONTAINER */}
      <div className="max-w-7xl mx-auto w-full flex-1 p-6 flex flex-col lg:flex-row gap-6">
        
        {/* LEFT PANEL: CONFIG & RECORDING */}
        <section className="no-print w-full lg:w-[480px] shrink-0 flex flex-col gap-6">
          
          {/* DESCRIPTION NOTE & OVERTIME REDUCTION METRIC */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col gap-4">
            <div className="flex gap-2.5 items-start">
              <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-1">使い方ガイド</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  1. <strong>基本設定</strong>で利用者名や出席者を設定（プルダウンで簡単割り当て可能）。<br />
                  2. <strong>音声録音</strong>で会議を直接録音、または<strong>音声ファイル</strong>をアップロードします。<br />
                  3. <strong>手動箇条書きメモ</strong>を添えると、AIの抽出要約精度が劇的に向上します。
                </p>
              </div>
            </div>

            {/* 居宅介護支援事業所リスト Excel Import Box */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <div className="flex justify-between items-center mb-1.5">
                <p className="font-bold text-slate-700 flex items-center gap-1">
                  <Database className="w-3.5 h-3.5 text-blue-600" />
                  居宅介護支援事業所リスト（Excelコピペ可）
                </p>
                <span className="text-[10px] text-slate-500 font-mono">居宅名 [タブ/スペース] ケアマネ名</span>
              </div>
              <textarea
                value={rawAgencyText}
                onChange={(e) => setRawAgencyText(e.target.value)}
                rows={3}
                className="w-full text-[11px] p-2 bg-white border border-slate-200 rounded font-mono focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 resize-none"
                placeholder="桃の郷 居宅介護支援事業所	鈴木 一郎"
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-[10px] text-slate-500 font-medium">登録件数: {agencyList.length} 件</span>
                <button
                  onClick={handleUpdateAgencies}
                  className="px-3 py-1 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-500 rounded border border-blue-600 shadow-2xs transition cursor-pointer"
                >
                  更新する
                </button>
              </div>
            </div>
          </div>

          {/* BLOCK 1: MEETING META SETTINGS */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h2 className="text-sm font-bold border-l-4 border-blue-600 pl-3 uppercase text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                1. 基本情報入力
              </h2>
              <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded">手動入力＆選択</span>
            </div>
            
            <div className="flex flex-col gap-4">
              {/* Client Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">利用者様名</label>
                  <input
                    type="text"
                    value={minutes.clientName}
                    onChange={(e) => handleMetaChange("clientName", e.target.value)}
                    placeholder="例: 桃野 太郎"
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">要介護度</label>
                  <select
                    value={minutes.careLevel}
                    onChange={(e) => handleMetaChange("careLevel", e.target.value)}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                  >
                    {CARE_LEVELS.map(cl => (
                      <option key={cl} value={cl}>{cl}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">開催日</label>
                  <input
                    type="date"
                    value={minutes.date}
                    onChange={(e) => handleMetaChange("date", e.target.value)}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors text-slate-700"
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">開始</label>
                    <input
                      type="text"
                      value={minutes.startTime}
                      onChange={(e) => handleMetaChange("startTime", e.target.value)}
                      placeholder="10:00"
                      className="w-full text-sm bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">終了</label>
                    <input
                      type="text"
                      value={minutes.endTime}
                      onChange={(e) => handleMetaChange("endTime", e.target.value)}
                      placeholder="11:00"
                      className="w-full text-sm bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Location & Reporter */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">開催場所</label>
                  <input
                    type="text"
                    value={minutes.location}
                    onChange={(e) => handleMetaChange("location", e.target.value)}
                    placeholder="例: 桃の郷 京都東山"
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">報告者名（あなた）</label>
                  <input
                    type="text"
                    value={minutes.reporterName}
                    onChange={(e) => handleMetaChange("reporterName", e.target.value)}
                    placeholder="例: 山田 花子"
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                  />
                </div>
              </div>

              {/* Home Care Agency */}
              <div className="mb-3">
                <label className="block text-xs font-bold text-slate-500 mb-1">居宅名（自動で議事録に反映されます）</label>
                <input
                  type="text"
                  value={minutes.homeCareAgency || ""}
                  onChange={(e) => handleAgencyChange(e.target.value)}
                  placeholder="例: 〇〇居宅介護支援事業所"
                  list="agency-options"
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                />
                <datalist id="agency-options">
                  {agencyList.map((item, idx) => (
                    <option key={idx} value={item.agency} />
                  ))}
                </datalist>
              </div>

              {/* Office Details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">事業所名</label>
                  <input
                    type="text"
                    value={minutes.officeName}
                    onChange={(e) => handleMetaChange("officeName", e.target.value)}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">報告日</label>
                  <input
                    type="date"
                    value={minutes.reportDate}
                    onChange={(e) => handleMetaChange("reportDate", e.target.value)}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors text-slate-700"
                  />
                </div>
              </div>

              {/* Meeting Attendees Grid setting (Collapsible-friendly scroll) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">出席者 (プルダウン選択)</label>
                <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50 max-h-[220px] overflow-y-auto flex flex-col gap-2">
                  {minutes.attendees.map((attendee, index) => (
                    <div key={attendee.id} className="flex gap-2 items-center bg-white p-2 rounded border border-slate-150 shadow-2xs">
                      <span className="text-[10px] text-slate-400 font-bold w-4 text-center">{index + 1}</span>
                      <input
                        type="text"
                        value={attendee.name}
                        onChange={(e) => handleAttendeeChange(index, "name", e.target.value)}
                        placeholder="氏名を入力"
                        list="cm-options"
                        className="w-2/5 text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                      />
                      <select
                        value={attendee.affiliation}
                        onChange={(e) => handleAttendeeChange(index, "affiliation", e.target.value)}
                        className="w-3/5 text-xs bg-slate-50 border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors text-slate-700 font-medium"
                      >
                        <option value="">（所属：未指定）</option>
                        <optgroup label="共通の所属・役職">
                          {PRESET_AFFILIATIONS.map(aff => (
                            <option key={aff} value={aff}>{aff.replace("\n", " ")}</option>
                          ))}
                        </optgroup>
                        {agencyList.length > 0 && (
                          <optgroup label="登録居宅リストから選択">
                            {agencyList
                              .map(item => item.agency)
                              .filter((value, idx, self) => value && self.indexOf(value) === idx)
                              .map(agency => (
                                <option key={agency} value={agency}>
                                  {agency}
                                </option>
                              ))
                            }
                          </optgroup>
                        )}
                      </select>
                    </div>
                  ))}
                  <datalist id="cm-options">
                    {agencyList.map((item, idx) => (
                      item.cm && <option key={idx} value={item.cm} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>
          </div>

          {/* BLOCK 2: AUDIO RECORDING & NOTES */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h2 className="text-sm font-bold border-l-4 border-orange-500 pl-3 uppercase text-slate-900 flex items-center gap-2">
                <Mic className="w-4 h-4 text-orange-500" />
                2. 音声データ取込＆メモ
              </h2>
              <span className="text-[10px] bg-orange-50 text-orange-700 font-bold px-2 py-0.5 rounded">音声・手動両対応</span>
            </div>

            <div className="flex flex-col gap-4">
              {/* Record / File Selector Box - Beautiful split row inside card */}
              <div className="flex flex-col md:flex-row gap-4">
                
                {/* Drag / Recorder Dropzone Container */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      setErrorMsg(null);
                      setAudioBlob(file);
                      setAudioUrl(URL.createObjectURL(file));
                      setUploadedFileName(file.name);
                    }
                  }}
                  className={`flex-1 border-2 border-dashed rounded-lg p-5 transition-all flex flex-col items-center justify-center text-center ${
                    isDragging
                      ? "border-blue-500 bg-blue-50/50 animate-pulse"
                      : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-slate-50/50"
                  }`}
                >
                  {/* Micro recorder UI */}
                  {isRecording ? (
                    <div className="flex flex-col items-center gap-2 w-full animate-pulse">
                      <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-red-50 border border-red-200 text-red-600 rounded-full text-[10px] font-bold">
                        <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-ping"></span>
                        録音中... ({formatDuration(recordingDuration)})
                      </div>
                      <button
                        onClick={stopRecording}
                        className="w-12 h-12 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center transition shadow-md cursor-pointer"
                        title="録音を停止"
                      >
                        <Square className="w-5 h-5 fill-white" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5">
                      <button
                        onClick={startRecording}
                        className="w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center transition shadow-md cursor-pointer"
                        title="会議の録音を開始"
                      >
                        <Mic className="w-5 h-5" />
                      </button>
                      <span className="text-[11px] font-bold text-slate-700">その場でスマホ等で録音</span>
                    </div>
                  )}

                  {/* Tiny divider */}
                  <div className="w-full flex items-center justify-center gap-2 my-1.5 text-slate-400 text-[10px]">
                    <div className="h-px bg-slate-200 flex-1"></div>
                    <span>または</span>
                    <div className="h-px bg-slate-200 flex-1"></div>
                  </div>

                  {/* File Upload Button */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="audio/*, .m4a, .mp3, .wav, .aac, .3gp, .ogg, .webm, .wma, .amr"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 text-[10px] font-bold text-slate-600 bg-white hover:bg-slate-50 rounded border border-slate-300 shadow-2xs flex items-center gap-1 cursor-pointer transition"
                  >
                    <Upload className="w-3 h-3" />
                    音声ファイルを選択
                  </button>
                  <p className="text-[9px] text-slate-400 mt-1">M4A, MP3, WAV 等に対応（ドラッグ＆ドロップ可）</p>
                </div>

                {/* AI status visual container side box from Design HTML */}
                <div className="w-full md:w-32 bg-slate-900 rounded-lg p-3 flex flex-col items-center justify-center text-white text-center gap-1.5 min-h-[110px] shrink-0">
                  {isLoading ? (
                    <>
                      <div className="animate-spin w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                      <p className="text-[10px] font-bold text-blue-300">AI要約中...</p>
                    </>
                  ) : (
                    <>
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <p className="text-[10px] font-bold text-emerald-400">AI待機中</p>
                      <p className="text-[9px] opacity-75">音声入力受付可能</p>
                    </>
                  )}
                </div>
              </div>

              {/* Status of audio loaded */}
              {audioUrl && (
                <div className="w-full bg-emerald-50 p-2.5 rounded-lg border border-emerald-100 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-bold justify-center">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>音声データの取り込み成功</span>
                  </div>
                  {uploadedFileName && (
                    <p className="text-[9px] text-slate-500 font-mono text-center truncate">{uploadedFileName}</p>
                  )}
                  <audio src={audioUrl} controls className="w-full h-8 mx-auto" />
                </div>
              )}

              {/* Manual Supplementary textNotes Box */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  手動箇条書きメモ（推奨：AI精度向上のために追加可能）
                </label>
                <textarea
                  value={textNotes}
                  onChange={(e) => setTextNotes(e.target.value)}
                  placeholder="例：
・本人の立ち上がり時のふらつきが強くなってお風呂が不安。
・ベッド脇にポータブルトイレを設置したいが、本人は消極的。
・手すりの設置をケアマネが手配する。"
                  rows={4}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded p-2.5 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-slate-700 placeholder:text-slate-400 leading-relaxed font-sans"
                />
                <p className="text-[10px] text-slate-400 mt-1">※音声録音が聞き取りにくい場合も、この箇条書きを補完することで高精度の議事録が作成されます。</p>
              </div>

              {/* ERROR STATE */}
              {errorMsg && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg flex items-start gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                  <div>{errorMsg}</div>
                </div>
              )}

              {/* SUBMIT BUTTON WITH STEPS */}
              <button
                onClick={handleGenerateMinutes}
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3.5 px-4 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>議事録を自動生成中...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-blue-200" />
                    <span>議事録を自動生成する</span>
                  </>
                )}
              </button>

              {/* PROGRESS FEEDBACK */}
              {isLoading && generationStep && (
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    <span className="text-xs font-bold text-blue-800">AI要約ステータス:</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5 font-sans leading-relaxed animate-pulse">
                    {generationStep}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT PANEL: A4 SHEET PREVIEW */}
        <section className="flex-1 flex flex-col gap-4">
          
          {/* HEADER ROW WITH PREVIEW STATS */}
          <div className="no-print bg-white rounded-xl border border-slate-200 p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="text-xs font-bold text-slate-800">A4サイズ リアルタイム印刷プレビュー</span>
              <span className="text-[10px] text-slate-400">紙面を直接クリック・ダブルクリックして加筆修正できます</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition shadow-sm cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                印刷する / PDF保存
              </button>
            </div>
          </div>

          {/* DRAFT NOTIFICATION TOAST */}
          {showSavedToast && (
            <div className="no-print bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-lg text-center shadow-lg animate-bounce">
              下書きデータをブラウザに保存しました！次回起動時も自動で復元されます。
            </div>
          )}

          {/* PHYSICAL A4 SHEET CANVAS CONTAINER */}
          <div className="print-sheet-container overflow-x-auto bg-slate-200 p-2 sm:p-6 rounded-2xl border border-slate-300 flex justify-center">
            
            {/* THE EXACT A4 PAGE COMPONENT (LANDSCAPE FORMAT) */}
            <div
              id="a4-preview-card"
              className="print-page bg-white text-black shadow-2xl relative select-text"
              style={{
                width: "297mm",
                minHeight: "210mm",
                padding: "8mm 12mm",
                boxSizing: "border-box"
              }}
            >
              
              {/* TOP HEADER / REPORT INFO */}
              <div className="flex justify-between items-end mb-3 gap-4">
                {/* Title */}
                <div className="flex-1 flex items-center justify-start pb-1">
                  <h1 className="text-[15px] font-bold tracking-[0.15em] border-b border-black pb-0.5 px-1" style={PREVIEW_FONT_STYLE}>
                    サービス担当者会議の要点
                  </h1>
                </div>

                {/* Right: Date & Office Box */}
                <div className="w-[320px] shrink-0 flex flex-col items-end">
                  <div className="text-[11px] font-normal mb-1.5 flex items-center justify-end w-full" style={PREVIEW_FONT_STYLE}>
                    <span>報告日　</span>
                    <div className="border-b border-black w-36 text-center flex justify-around" style={PREVIEW_FONT_STYLE}>
                      <span>{repDateJapanese.year}</span>
                      <span>年</span>
                      <span>{repDateJapanese.month}</span>
                      <span>月</span>
                      <span>{repDateJapanese.day}</span>
                      <span>日</span>
                    </div>
                  </div>

                  <div className="w-full border border-black text-[11px]" style={PREVIEW_FONT_STYLE}>
                    <div className="flex border-b border-black">
                      <div className="w-20 bg-slate-50 p-1 border-r border-black font-medium text-center flex items-center justify-center shrink-0 h-7 text-[11px]">
                        事業所名
                      </div>
                      <div className="flex-1 px-2 flex items-center h-7">
                        <input
                          type="text"
                          value={minutes.officeName}
                          onChange={(e) => handleMetaChange("officeName", e.target.value)}
                          className="w-full bg-transparent border-none p-0 text-[11px] focus:outline-none font-normal"
                          style={CONTENT_FONT_STYLE}
                        />
                      </div>
                    </div>
                    <div className="flex">
                      <div className="w-20 bg-slate-50 p-1 border-r border-black font-medium text-center flex items-center justify-center shrink-0 h-7 text-[11px]">
                        報告者名
                      </div>
                      <div className="flex-1 px-2 flex items-center h-7">
                        <input
                          type="text"
                          value={minutes.reporterName}
                          onChange={(e) => handleMetaChange("reporterName", e.target.value)}
                          placeholder="（未入力）"
                          className="w-full bg-transparent border-none p-0 text-[11px] focus:outline-none font-normal"
                          style={CONTENT_FONT_STYLE}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* PATIENT INFO TABLE (A4 横 HIGH-FIDELITY GRID) */}
              <table className="w-full border-collapse border border-black text-xs mb-3 animate-fade-in" style={PREVIEW_FONT_STYLE}>
                <tbody>
                  {/* Row 1 */}
                  <tr className="border-b border-black">
                    {/* label: 利用者様名 */}
                    <td className="w-[12%] bg-slate-50 py-1.5 px-1 border-r border-black font-medium text-center text-[11px]" style={PREVIEW_FONT_STYLE}>
                      利用者様名
                    </td>
                    {/* value: Client Name with "様" */}
                    <td className="w-[28%] py-1.5 px-2 border-r border-black">
                      <div className="flex items-center justify-between gap-1 w-full h-full">
                        <input
                          type="text"
                          value={minutes.clientName}
                          onChange={(e) => handleMetaChange("clientName", e.target.value)}
                          placeholder="（未入力）"
                          className="w-full bg-transparent border-none p-0 focus:outline-none font-normal text-[15px] text-center"
                          style={CONTENT_FONT_STYLE}
                        />
                        <span className="pr-1 text-[15px] font-normal shrink-0" style={CONTENT_FONT_STYLE}>様</span>
                      </div>
                    </td>
                    {/* label: 介護度 */}
                    <td className="w-[10%] bg-slate-50 py-1.5 px-2 border-r border-black font-medium text-center text-[11px]" style={PREVIEW_FONT_STYLE}>
                      介護度
                    </td>
                    {/* value: Care Level Dropdown */}
                    <td className="w-[14%] py-1.5 px-1 border-r border-black text-center">
                      <select
                        value={minutes.careLevel}
                        onChange={(e) => handleMetaChange("careLevel", e.target.value)}
                        className="w-full bg-transparent border-none text-center focus:outline-none text-[11px] font-normal cursor-pointer"
                        style={CONTENT_FONT_STYLE}
                      >
                        {CARE_LEVELS.map(cl => (
                          <option key={cl} value={cl}>{cl}</option>
                        ))}
                      </select>
                    </td>
                    {/* label: 開催日 */}
                    <td className="w-[12%] bg-slate-50 py-1.5 px-2 border-r border-black font-medium text-center text-[11px]" style={PREVIEW_FONT_STYLE}>
                      開催日
                    </td>
                    {/* value: Meeting Date */}
                    <td className="w-[24%] py-1.5 px-2 text-center">
                      <div className="flex justify-center gap-0.5 items-center text-[12px] font-normal" style={PREVIEW_FONT_STYLE}>
                        <span>{meetDateJapanese.year}</span>
                        <span>年</span>
                        <span>{meetDateJapanese.month}</span>
                        <span>月</span>
                        <span>{meetDateJapanese.day}</span>
                        <span>日</span>
                        <span className="ml-0.5 text-slate-800">（{getJapaneseWeekday(minutes.date)}）</span>
                      </div>
                    </td>
                  </tr>

                  {/* Row 2 */}
                  <tr>
                    {/* label: 開催場所 */}
                    <td className="w-[12%] bg-slate-50 py-1.5 px-1 border-r border-black font-medium text-center text-[11px]" style={PREVIEW_FONT_STYLE}>
                      開催場所
                    </td>
                    {/* value: Location (spans 3 cells) */}
                    <td colSpan={3} className="py-1.5 px-2 border-r border-black">
                      <input
                        type="text"
                        value={minutes.location}
                        onChange={(e) => handleMetaChange("location", e.target.value)}
                        className="w-full bg-transparent border-none p-0 focus:outline-none font-normal text-[11px] text-center"
                        style={CONTENT_FONT_STYLE}
                      />
                    </td>
                    {/* label: 開催時間 */}
                    <td className="w-[12%] bg-slate-50 py-1.5 px-2 border-r border-black font-medium text-center text-[11px]" style={PREVIEW_FONT_STYLE}>
                      開催時間
                    </td>
                    {/* value: Times manually editable in HH:MM format */}
                    <td className="py-1.5 px-2">
                      <div className="flex items-center justify-center gap-1 text-[12px] font-normal" style={PREVIEW_FONT_STYLE}>
                        <input
                          type="text"
                          value={minutes.startTime}
                          onChange={(e) => handleMetaChange("startTime", e.target.value)}
                          placeholder="00:00"
                          className="w-12 bg-transparent border-none p-0 text-center focus:outline-none text-[12px] font-normal text-center"
                          style={PREVIEW_FONT_STYLE}
                        />
                        <span className="text-[12px] font-normal mx-1" style={PREVIEW_FONT_STYLE}>〜</span>
                        <input
                          type="text"
                          value={minutes.endTime}
                          onChange={(e) => handleMetaChange("endTime", e.target.value)}
                          placeholder="00:00"
                          className="w-12 bg-transparent border-none p-0 text-center focus:outline-none text-[12px] font-normal text-center"
                          style={PREVIEW_FONT_STYLE}
                        />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* ATTENDANCE LIST GRID (8 BOXES IN 4 COLS X 2 ROWS) */}
              <table className="w-full border-collapse border border-black text-[11px] mb-3" style={PREVIEW_FONT_STYLE}>
                <tbody>
                  {/* Header Row */}
                  <tr className="border-b border-black bg-slate-50 font-medium text-[11px]">
                    <td rowSpan={3} className="w-[12%] bg-slate-50 border-r border-black font-medium text-center py-1 px-1 text-[11px]" style={PREVIEW_FONT_STYLE}>
                      会議出席者
                    </td>
                    <td className="w-[11%] py-1 px-0.5 text-center border-r border-black">氏名</td>
                    <td className="w-[11%] py-1 px-0.5 text-center border-r border-black">所属</td>
                    <td className="w-[11%] py-1 px-0.5 text-center border-r border-black">氏名</td>
                    <td className="w-[11%] py-1 px-0.5 text-center border-r border-black">所属</td>
                    <td className="w-[11%] py-1 px-0.5 text-center border-r border-black">氏名</td>
                    <td className="w-[11%] py-1 px-0.5 text-center border-r border-black">所属</td>
                    <td className="w-[11%] py-1 px-0.5 text-center border-r border-black">氏名</td>
                    <td className="w-[11%] py-1 px-0.5 text-center">所属</td>
                  </tr>

                  {/* Attendee Row 1 (index 0 - 3) */}
                  <tr className="border-b border-black">
                    {minutes.attendees.slice(0, 4).map((att, idx) => (
                      <React.Fragment key={att.id}>
                        <td className="w-[11%] p-0.5 border-r border-black relative">
                          <div className="flex items-center justify-center min-h-[22px] px-1">
                            <AutoResizeTextarea
                              value={att.name}
                              onChange={(e) => handleAttendeeChange(idx, "name", e.target.value)}
                              className="w-full bg-transparent border-none text-center leading-tight focus:outline-none whitespace-pre-wrap break-words break-all"
                              style={{
                                fontFamily: CONTENT_FONT_FAMILY,
                                fontSize: getDynamicFontSize(att.name, false),
                                fontWeight: "normal"
                              }}
                              rows={1}
                            />
                            {att.name && isUserOrFamily(att.affiliation) && !att.name.endsWith("様") && (
                              <span className="absolute right-0.5 text-[10px] font-normal text-slate-800" style={CONTENT_FONT_STYLE}>様</span>
                            )}
                          </div>
                        </td>
                        <td className="w-[11%] p-0.5 border-r last:border-r-0 border-black">
                          <div className="flex items-center justify-center min-h-[22px]">
                            <AutoResizeTextarea
                              value={att.affiliation}
                              onChange={(e) => handleAttendeeChange(idx, "affiliation", e.target.value)}
                              className="w-full bg-transparent border-none text-center leading-tight focus:outline-none whitespace-pre-wrap break-words break-all"
                              style={{
                                fontFamily: CONTENT_FONT_FAMILY,
                                fontSize: getDynamicFontSize(att.affiliation, true),
                                fontWeight: "normal"
                              }}
                              rows={1}
                            />
                          </div>
                        </td>
                      </React.Fragment>
                    ))}
                  </tr>

                  {/* Attendee Row 2 (index 4 - 7) */}
                  <tr>
                    {minutes.attendees.slice(4, 8).map((att, idx) => {
                      const globalIdx = idx + 4;
                      return (
                        <React.Fragment key={att.id}>
                          <td className="w-[11%] p-0.5 border-r border-black relative">
                            <div className="flex items-center justify-center min-h-[22px] px-1">
                              <AutoResizeTextarea
                                value={att.name}
                                onChange={(e) => handleAttendeeChange(globalIdx, "name", e.target.value)}
                                className="w-full bg-transparent border-none text-center leading-tight focus:outline-none whitespace-pre-wrap break-words break-all"
                                style={{
                                  fontFamily: CONTENT_FONT_FAMILY,
                                  fontSize: getDynamicFontSize(att.name, false),
                                  fontWeight: "normal"
                                }}
                                rows={1}
                              />
                              {att.name && isUserOrFamily(att.affiliation) && !att.name.endsWith("様") && (
                                <span className="absolute right-0.5 text-[10px] font-normal text-slate-800" style={CONTENT_FONT_STYLE}>様</span>
                              )}
                            </div>
                          </td>
                          <td className="w-[11%] p-0.5 border-r last:border-r-0 border-black">
                            <div className="flex items-center justify-center min-h-[22px]">
                              <AutoResizeTextarea
                                value={att.affiliation}
                                onChange={(e) => handleAttendeeChange(globalIdx, "affiliation", e.target.value)}
                                className="w-full bg-transparent border-none text-center leading-tight focus:outline-none whitespace-pre-wrap break-words break-all"
                                style={{
                                  fontFamily: CONTENT_FONT_FAMILY,
                                  fontSize: getDynamicFontSize(att.affiliation, true),
                                  fontWeight: "normal"
                                }}
                                rows={1}
                              />
                            </div>
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                </tbody>
              </table>

              {/* ① 検討項目 SECTION */}
              <div className="flex border border-black text-xs mb-2.5">
                <div className="w-[12%] bg-slate-50 p-2 border-r border-black font-medium text-center flex items-center justify-center shrink-0 leading-tight text-[11px]" style={PREVIEW_FONT_STYLE}>
                  検討項目
                </div>
                <div className="flex-1 p-2">
                  <AutoResizeTextarea
                    value={minutes.discussedItems}
                    onChange={(e) => handleMetaChange("discussedItems", e.target.value)}
                    placeholder="① 検討項目がここに表示されます。"
                    rows={1}
                    className="w-full bg-transparent border-none p-0 text-[11px] focus:outline-none leading-relaxed font-normal resize-none whitespace-pre-wrap break-words break-all"
                    style={{ minHeight: "28px", fontFamily: CONTENT_FONT_FAMILY }}
                  />
                </div>
              </div>

              {/* ② 検討内容 SECTION */}
              <div className="flex border border-black text-xs mb-2.5">
                <div className="w-[12%] bg-slate-50 p-2 border-r border-black font-medium text-center flex items-center justify-center shrink-0 leading-tight text-[11px]" style={PREVIEW_FONT_STYLE}>
                  検討内容
                </div>
                <div className="flex-1 p-2">
                  <AutoResizeTextarea
                    value={minutes.discussionContent}
                    onChange={(e) => handleMetaChange("discussionContent", e.target.value)}
                    placeholder="② 検討した各担当者や家族・本人の意見と検討経過がここに表示されます。直接書き換え可能です。"
                    rows={9}
                    className="w-full bg-transparent border-none p-0 text-[11px] focus:outline-none leading-relaxed font-normal resize-none whitespace-pre-wrap break-words break-all"
                    style={{ minHeight: "220px", fontFamily: CONTENT_FONT_FAMILY }}
                  />
                </div>
              </div>

              {/* ③ 結論 SECTION */}
              <div className="flex border border-black text-xs mb-2.5">
                <div className="w-[12%] bg-slate-50 p-2 border-r border-black font-medium text-center flex items-center justify-center shrink-0 leading-tight text-[11px]" style={PREVIEW_FONT_STYLE}>
                  結論
                </div>
                <div className="flex-1 p-2">
                  <AutoResizeTextarea
                    value={minutes.conclusion}
                    onChange={(e) => handleMetaChange("conclusion", e.target.value)}
                    placeholder="③ 合意された援助方針や結論がここに表示されます。"
                    rows={4}
                    className="w-full bg-transparent border-none p-0 text-[11px] focus:outline-none leading-relaxed font-normal resize-none whitespace-pre-wrap break-words break-all"
                    style={{ minHeight: "100px", fontFamily: CONTENT_FONT_FAMILY }}
                  />
                </div>
              </div>

              {/* ④ 残された課題 SECTION */}
              <div className="flex border border-black text-xs mb-2.5">
                <div className="w-[12%] bg-slate-50 p-2 border-r border-black font-medium text-center flex items-center justify-center shrink-0 leading-tight text-[11px]" style={PREVIEW_FONT_STYLE}>
                  残された課題
                </div>
                <div className="flex-1 p-2">
                  <AutoResizeTextarea
                    value={minutes.remainingIssues}
                    onChange={(e) => handleMetaChange("remainingIssues", e.target.value)}
                    placeholder="④ 次回までに確認する事項、今後経過を観察すべき点がここに表示されます。"
                    rows={3}
                    className="w-full bg-transparent border-none p-0 text-[11px] focus:outline-none leading-relaxed font-normal resize-none whitespace-pre-wrap break-words break-all"
                    style={{ minHeight: "65px", fontFamily: CONTENT_FONT_FAMILY }}
                  />
                </div>
              </div>

              {/* (次回の開催時期予定) SECTION */}
              <div className="flex border border-black text-xs">
                <div className="bg-slate-50 p-2 border-r border-black font-medium shrink-0 text-center flex items-center justify-center w-[12%] text-[11px]" style={PREVIEW_FONT_STYLE}>
                  （次回の開催時期予定）
                </div>
                <div className="flex-1 px-3 py-1.5 flex items-center">
                  <input
                    type="text"
                    value={minutes.nextMeeting}
                    onChange={(e) => handleMetaChange("nextMeeting", e.target.value)}
                    placeholder="例：次回更新時、状態変化時など"
                    className="w-full bg-transparent border-none p-0 text-[11px] focus:outline-none font-normal text-slate-900"
                    style={{ fontFamily: CONTENT_FONT_FAMILY }}
                  />
                </div>
              </div>

            </div>
          </div>
        </section>

      </div>

      {/* FOOTER */}
      <footer className="no-print bg-white border-t border-slate-200 py-6 px-4 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p>© 2026 サービス担当者会議 議事録自動作成システム. All rights reserved.</p>
          <div className="flex gap-4">
            <span>マイク録音・ファイル取り込み：Android、iOS、PC 対応</span>
            <span>AI要約：Gemini 3.5 Flash 高速分析</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
