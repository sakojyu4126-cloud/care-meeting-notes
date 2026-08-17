import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

function generateLocalFallback(textNotes: string, clientName: string, careLevel: string, date: string, location: string, attendees: any[]) {
  const lines = textNotes
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0);

  let discussedItems = "";
  let discussionContent = "";
  let conclusion = "";
  let remainingIssues = "";
  const nextMeeting = "状態変化時、または次回更新期日（およそ3ヶ月後〜半年後を目安に要調整）";

  if (lines.length > 0) {
    const items: string[] = [];
    const contents: string[] = [];
    const conclusions: string[] = [];
    const issues: string[] = [];

    for (const line of lines) {
      const cleanLine = line.replace(/^[・\-\*\d+\.\s]+/, "");
      if (!cleanLine) continue;

      if (line.includes("課題") || line.includes("今後") || line.includes("観察") || line.includes("確認") || line.includes("次回")) {
        issues.push(cleanLine);
      } else if (line.includes("結論") || line.includes("決定") || line.includes("合意") || line.includes("方針") || line.includes("設置") || line.includes("増やす")) {
        conclusions.push(cleanLine);
      } else if (line.includes("ふらつき") || line.includes("不安") || line.includes("意見") || line.includes("意向") || line.includes("要望") || line.includes("話し合い") || line.includes("提案") || line.includes("検討")) {
        contents.push(cleanLine);
      } else {
        if (items.length < 3) {
          items.push(cleanLine);
        } else if (contents.length < 4) {
          contents.push(cleanLine);
        } else if (conclusions.length < 3) {
          conclusions.push(cleanLine);
        } else {
          issues.push(cleanLine);
        }
      }
    }

    if (items.length > 0) {
      discussedItems = items.map(item => `・${item}`).join("\n");
    } else {
      discussedItems = "・安全な生活動作（ADL）の確保と転倒防止策について\n・現在利用中の訪問介護・デイサービス内容の見直しと回数の検討";
    }

    if (contents.length > 0) {
      discussionContent = `【本人・家族の要望、各専門職の意見】\n` + 
        contents.map(c => `・${c}`).join("\n") +
        `\n\n【協議の経緯】\n本人の日常生活上の危険箇所やふらつきに対して、ご家族の安全への配慮と本人のリハビリ・自立支援の希望を両立するため、各事業所の専門意見を交えて具体的な対策を検討いたしました。`;
    } else {
      discussionContent = `【本人・家族の要望、各専門職の意見】\n・利用者本人：「まだ自力で移動できる」との思いはあるが、夜間移動時の多少のふらつきや不安は自覚されている。\n・ご家族：「夜間に1人でトイレへ行く際のふらつきが顕著で、転倒による骨折が一番心配。早めに対策をしたい」と強く希望。\n・ケアマネジャー：安全確保を第一優先としつつ、本人の尊厳と活動性を損なわない範囲でのポータブルトイレ設置や入浴介助の強化を提案。`;
    }

    if (conclusions.length > 0) {
      conclusion = conclusions.map(c => `・${c}`).join("\n");
    } else {
      conclusion = `・夜間の転倒リスク低減のため、本人が合意した範囲でベッドサイドへポータブルトイレを試験的に設置・導入する。\n・入浴中の安全確保と心身の清潔保持のため、訪問介護（入浴介助）のサービス提供回数を週2回から週3回へ増やすことを決定。`;
    }

    if (issues.length > 0) {
      remainingIssues = issues.map(i => `・${i}`).join("\n");
    } else {
      remainingIssues = `・ポータブルトイレの実際の使用状況や心理的抵抗感がないかについて、ご家族および訪問ヘルパーが継続的に見守りを行う。\n・導入した感知式フットライトの有効性とふらつきの変化について、1週間後にケアマネジャーが状況をヒアリングする。`;
    }

  } else {
    discussedItems = "・夜間帯の排泄時における転倒リスクの軽減と安全確保について\n・訪問介護サービスの利用回数および支援内容の見直し（入浴介助の強化）";
    discussionContent = `【本人・家族の要望、各専門職の意見】
・利用者本人より：「まだ自分の足で歩ける」と主張され、福祉用具の導入には消極的であるが、夜間のふらつきに対する不安自体は自覚されている。
・ご家族より：「夜間に一人でトイレに行く際の足元のふらつきが日に日に強くなっており、転倒・骨折が非常に不安。安心できる環境を整えたい」との強い訴えあり。
・担当ケアマネジャーより：現在の要介護度（要介護2）と身体状況を踏まえ、ベッドサイドへのポータブルトイレ（PT）設置、及び入浴介助の回数を増やすことを提案。
・HS（桃の郷 京都東山）より：入浴時の見守り・介助時間を確保するため、ヘルパー派遣を週2回から週3回へ増やすことで、皮膚状態の観察や清潔保持がより確実に実施できると助言。`;
    conclusion = `・転倒リスクの最も高い夜間排泄の安全対策として、ベッド横へポータブルトイレ（木製調）を仮設置する（ご家族が管理・清掃を協力する条件で本人が同意）。
・入浴介助の充実および生活サポート強化のため、訪問介護サービス（週2回）を週3回へ増回することを決定。
・寝室から廊下・トイレにかけての動線に、感知式フットライト（センサーライト）を設置し、夜間の足元照度を確保する。`;
    remainingIssues = `・新たに導入するポータブルトイレの使用状況（本人が実際に使用できているか、心理的抵抗がないか）について、ヘルパーおよびご家族が経過を観察する。
・フットライト設置後の夜間移動時のふらつき変化について、1週間後にケアマネジャーがご家族より聞き取りを行う。
・本人の自立支援と安全性のバランスを考慮し、福祉用具の手すり増設についても継続検討課題とする。`;
  }

  return {
    discussedItems,
    discussionContent,
    conclusion,
    remainingIssues,
    nextMeeting,
    suggestedClientName: clientName || "佐藤 恵美子",
    suggestedCareLevel: careLevel || "要介護2",
    suggestedDate: date || new Date().toISOString().split("T")[0],
    suggestedLocation: location || "利用者様宅",
    apiFallbackUsed: true,
    fallbackUsed: false,
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for audio files (base64)
  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ limit: "100mb", extended: true }));

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("Warning: GEMINI_API_KEY environment variable is not set.");
  }

  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API Routes
  app.post("/api/generate-minutes", async (req: express.Request, res: express.Response) => {
    try {
      const { audioBase64, mimeType, textNotes, clientName, careLevel, date, location, attendees } = req.body;

      let finalNotes = textNotes || "";
      let fallbackUsed = false;

      if (!audioBase64 && !finalNotes.trim()) {
        fallbackUsed = true;
        finalNotes = `・佐藤 恵美子 様（要介護2）のサービス担当者会議。
・夜間帯の排泄時における転倒リスクの軽減について検討。
・最近、夜間にトイレに起きた際のふらつきが強くなっている。
・ベッド脇へのポータブルトイレ設置を提案。本人は「まだ歩ける」と消極的だが、手すり設置を含め再検討。
・入浴介助の不足を補うため、ヘルパー派遣を週3回に増やすことを検討。
・寝室からトイレまでの動線にセンサーライトを仮設置し、1週間経過を観察する。`;
      }

      // Construct content parts for Gemini
      const parts: any[] = [];

      // If user provided base64 audio, add it
      if (audioBase64 && mimeType) {
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: audioBase64
          }
        });
      }

      // Add instruction details
      let promptText = `
あなたは訪問介護・ケアマネジメントの専門家、かつサービス担当者会議（サービス提供者・CM・家族・本人が集まる会議）の記録管理者です。
提供された情報（録音音声、および/または手動のメモ・書き起こしテキスト）を精査し、介護保険制度における正式な「サービス担当者会議の要点」を作成してください。

【あらかじめ入力されている基本情報（もしあれば補正や補完の参考にしてください）】
- 利用者名: ${clientName || "未指定"}
- 介護度: ${careLevel || "未指定"}
- 開催日: ${date || "未指定"}
- 開催場所: ${location || "未指定"}
- 会議出席者: ${attendees ? JSON.stringify(attendees) : "未指定"}

【追加の手動メモ・書き起こしテキスト情報（もしあれば強力な手がかりにしてください）】
${finalNotes}

【指示事項】
1. 音声録音（提供されている場合）を十分に聴き取り、発話内容から重要な「①検討項目」「②検討内容」「③結論」「④残された課題」を抽出してください。
2. 音声がない場合は、手動メモ・テキスト情報のみから上記4項目を美しく構成してください。
3. 日本の介護保険におけるサービス担当者会議の議事録フォーマット（法定保管用）としてふさわしい、客観的で専門的、かつ丁寧な言葉遣い（〜を検討。〜との意向あり。〜に決定。等のカルテ・公文書調、または「です・ます」調）でまとめてください。
4. 以下の4つの項目を確実に作成してください。
  ① 検討項目：会議で協議された主要な論点・議題を簡潔に箇条書きで。
  ② 検討内容：本人のニーズや変化、家族の意向・要望、ヘルパー（HS 桃の郷）やデイサービス（DS 桃の郷）、ケアマネジャー（CM）等の専門的な意見や提案、および議論がどのように進んだかの具体的な対話のプロセス。
  ③ 結論：最終的に合意されたサービス方針、具体的な援助方法、サービスの回数やタイミング、留意事項。
  ④ 残された課題：今後の生活状態の変化への対応方針、次回までに家族やケアマネが確認すべき事項、経過観察すべき点、役割分担。
5. 音声/テキストから「次回の開催予定時期」が聞き取れる、または推測できる場合は、nextMeeting にその内容（例：「状態変化時」「次回更新時」「〇ヶ月後」等）を記載してください。
6. 音声から、あらかじめ入力されていない「利用者氏名」「介護度」「開催日」「開催場所」についての手がかりがある場合は、それらを抽出して候補（suggestedClientName, suggestedCareLevel, suggestedDate, suggestedLocation）として出力に含めてください。
`;

      parts.push({ text: promptText });

      let response: any = null;
      let success = false;
      let attempts = 0;
      const maxAttempts = 2;
      let lastError: any = null;

      while (attempts < maxAttempts && !success) {
        try {
          attempts++;
          response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: { parts },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  discussedItems: { type: Type.STRING, description: "①検討項目。要約・論点を分かりやすく箇条書きで。" },
                  discussionContent: { type: Type.STRING, description: "②検討内容。本人・家族の要望、各担当者の意見、議論の経緯。" },
                  conclusion: { type: Type.STRING, description: "③結論。合意された具体的なサービス内容、援助方針、ルール。" },
                  remainingIssues: { type: Type.STRING, description: "④残された課題。今後経過観察すべきこと、確認事項、役割分担。" },
                  nextMeeting: { type: Type.STRING, description: "次回の開催時期予定。なければ「状態変化時」など適切に入力。" },
                  suggestedClientName: { type: Type.STRING, description: "音声/メモから抽出した利用者氏名（推測）。なければ空文字。" },
                  suggestedCareLevel: { type: Type.STRING, description: "音声/メモから抽出した要介護度（要支援1〜2、要介護1〜5）。なければ空文字。" },
                  suggestedDate: { type: Type.STRING, description: "音声/メモから抽出した開催日付（YYYY-MM-DDなど）。なければ空文字。" },
                  suggestedLocation: { type: Type.STRING, description: "音声/メモから抽出した開催場所。なければ空文字。" }
                },
                required: ["discussedItems", "discussionContent", "conclusion", "remainingIssues", "nextMeeting"]
              },
              temperature: 0.1, // 低めにしてファクトベースの正確な要約を期待
            }
          });
          success = true;
        } catch (err: any) {
          lastError = err;
          console.warn(`Gemini generation attempt ${attempts} failed:`, err.message || err);
          if (attempts < maxAttempts) {
            // Short backoff delay
            await new Promise((resolve) => setTimeout(resolve, 1200));
          }
        }
      }

      if (!success) {
        console.warn("All Gemini API attempts failed. Falling back to local summarizer.", lastError);
        const fallbackResult = generateLocalFallback(
          finalNotes, 
          clientName, 
          careLevel, 
          date, 
          location, 
          attendees || []
        );
        fallbackResult.fallbackUsed = fallbackUsed;
        return res.json(fallbackResult);
      }

      const resultText = response?.text;
      if (!resultText) {
        throw new Error("Gemini APIからの応答が空でした。");
      }

      const parsedResult = JSON.parse(resultText);
      parsedResult.fallbackUsed = fallbackUsed;
      parsedResult.apiFallbackUsed = false;
      res.json(parsedResult);
    } catch (error: any) {
      console.error("Error generating minutes:", error);
      res.status(500).json({ error: error.message || "議事録の生成中にエラーが発生しました。" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
