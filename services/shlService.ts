
/// <reference types="vite/client" />

import { GoogleGenAI } from "@google/genai";
import { googleSheetService } from './googleSheetService';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
if (!API_KEY) console.error("[shlService] FATAL: VITE_GEMINI_API_KEY is missing from the environment.");

// Use gemini-3.1-flash-lite as primary and fallback
const MODEL_NAME = 'gemini-3.1-flash-lite';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';

export const shlService = {
  /**
   * Main entry point for processing SHL reports.
   * Renamed from processAndRegister to registerUserFromPDF to match contract.
   */
  registerUserFromPDF: async (file: File | undefined, coachEmail?: string) => {
    // Safety Guard: Immediate check for valid file object
    if (!file || !(file instanceof File)) {
      console.error("[performanceService] Invalid file object received:", file);
      throw new Error("Registry Error: The processing hub received an invalid or missing file reference.");
    }

    const fileName = file.name || 'Candidate_Report.pdf';
    console.log(`[performanceService] Processing ${fileName} via Intelligence Extraction`);

    try {
      const data = await shlService.processInline(file);

      // Step 3: Register results in the global registry
      const registration = await googleSheetService.createUser({
        name: data.candidateName,
        email: data.email,
        cefrLevel: data.cefrLevel,
        metrics: data.metrics,
        assignedCoach: coachEmail || 'Unassigned',
        password: 'TpSkill2026!'
      });

      return { metrics: data.metrics, registration };
    } catch (error) {
      console.error("[performanceService] Processing Hub Error:", (error as Error).message);
      throw error;
    }
  },

  /**
   * Pipeline for processing files using inline Base64 data.
   * This avoids the "Action not implemented" error associated with the Files API.
   */
  processInline: async (file: File): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        if (!result) return reject(new Error("File conversion resulted in empty buffer."));
        resolve(result.split(',')[1]);
      };
      reader.onerror = () => reject(new Error("Failed to read file into memory."));
      reader.readAsDataURL(file);
    });

    const executeAnalysis = async (model: string) => {
      return await ai.models.generateContent({
        model: model,
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: 'application/pdf' } },
            { text: shlService.getAnalysisPrompt() }
          ]
        }
      });
    };

    try {
      console.log(`[shlService] Attempting analysis with primary model: ${MODEL_NAME}`);
      const response = await executeAnalysis(MODEL_NAME);
      return shlService.parseAndClean(response.text);
    } catch (primaryError) {
      console.warn(`[shlService] Primary model ${MODEL_NAME} failed or rejected PDF. Falling back to ${FALLBACK_MODEL}.`, primaryError);
      try {
        const fallbackResponse = await executeAnalysis(FALLBACK_MODEL);
        return shlService.parseAndClean(fallbackResponse.text);
      } catch (fallbackError) {
        console.error("[shlService] Both models failed to process the PDF.", fallbackError);
        throw new Error("Registry Error: The intelligence engine failed to process the assessment report.");
      }
    }
  },

  /**
   * System Instruction for the Intelligence Extraction
   */
  getAnalysisPrompt: () => {
    return `Perform an expert deep-parsing of this Candidate Assessment Report. 
    Map the data into a strict JSON structure following this schema:
    
    - candidateName: Full name of the candidate.
    - email: Candidate's contact email found in the report.
    - cefrLevel: The detected overall CEFR level (A1, A2, B1, B2, C1, or C2).
    - metrics:
        - fluency: score (0-100)
        - vocabulary: score (0-100)
        - grammar: score (0-100)
        - pronunciation: score (0-100)
        - coherence: score (0-100)

    CRITICAL: You must return ONLY a raw JSON object. Do not include markdown formatting, backticks, or conversational text.`;
  },

  /**
   * Sanitizer for AI output to ensure valid JSON registry entry.
   */
  parseAndClean: (text: string | undefined): any => {
    if (!text) throw new Error("Intelligence Extraction Failed: Empty response from engine.");
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON object found in response");
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("[shlService] Parsing Collision. Raw text:", text);
      throw new Error("Registry Error: The candidate intelligence could not be formatted correctly.");
    }
  }
};
