import { Injectable } from '@angular/core';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';

export interface SongInfo {
  title: string;
  album: string;
  year: string;
  lyrics: string;
}

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY environment variable not set");
    }
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  private parseSongInfo(text: string): SongInfo {
    const titleMatch = text.match(/Title:\s*(.*)/i);
    const albumMatch = text.match(/Album:\s*(.*)/i);
    const yearMatch = text.match(/Year:\s*(.*)/i);
    const lyricsMatch = text.match(/---LYRICS_START---\s*([\s\S]*?)\s*---LYRICS_END---/i);

    if (titleMatch && albumMatch && yearMatch && lyricsMatch) {
      return {
        title: titleMatch[1].trim(),
        album: albumMatch[1].trim(),
        year: yearMatch[1].trim(),
        lyrics: lyricsMatch[1].trim(),
      };
    }
    throw new Error('Nije moguće parsirati informacije o pjesmi iz odgovora.');
  }

  async identifySong(query: string): Promise<SongInfo> {
    try {
      const response: GenerateContentResponse = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are an expert on Croatian music. A user has provided the following query: "${query}". Identify the song by Marko Perković Thompson. Use Google Search to find the most accurate information. Respond with ONLY the following format, and nothing else:
Title: [Song Title]
Album: [Album Name]
Year: [Year of Release]
---LYRICS_START---
[Full song lyrics here]
---LYRICS_END---
If you cannot identify the song, respond with "Error: Song not found."`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const responseText = response.text.trim();
      if (responseText.toLowerCase().startsWith('error:')) {
        throw new Error('Pjesma nije pronađena. Pokušajte s preciznijim upitom.');
      }
      return this.parseSongInfo(responseText);
    } catch (e) {
      console.error("Error in identifySong:", e);
      throw new Error("Nije uspjelo dohvaćanje informacija o pjesmi. Provjerite mrežnu vezu i pokušajte ponovno.");
    }
  }

  async generateAnalysis(songInfo: SongInfo, analysisType: 'theological' | 'political'): Promise<string> {
    const personaPrompt = this.getPersonaPrompt(analysisType);
    const userPrompt = `Analiziraj pjesmu "${songInfo.title}" s albuma "${songInfo.album}" (${songInfo.year}). Stihovi su:\n\n${songInfo.lyrics}`;

    try {
      const response: GenerateContentResponse = await this.ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: userPrompt,
        config: {
          systemInstruction: personaPrompt,
          thinkingConfig: { thinkingBudget: 32768 }
        },
      });
      return response.text;
    } catch (e) {
      console.error("Error in generateAnalysis:", e);
      throw new Error("Nije uspjelo generiranje analize. Pokušajte ponovno.");
    }
  }

  async generateImageForSong(songTitle: string, analysis: string): Promise<string> {
    const prompt = `Generate a visually stunning, symbolic, and artistic image inspired by the themes of the Croatian patriotic song "${songTitle}". Key themes from its analysis are: ${analysis.substring(0, 400)}. The style should be epic, powerful, and respectful, avoiding literal depictions of people or conflict. Think in terms of allegorical art, focusing on concepts like homeland, faith, sacrifice, and resilience.`;
    try {
      const response = await this.ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: prompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/png',
            aspectRatio: '16:9',
        },
      });

      if (response.generatedImages && response.generatedImages.length > 0) {
        const base64ImageBytes = response.generatedImages[0].image.imageBytes;
        return `data:image/png;base64,${base64ImageBytes}`;
      }
      throw new Error('Nije generirana slika.');
    } catch (e) {
        console.error("Error in generateImageForSong:", e);
        throw new Error("Nije uspjelo generiranje slike. Pokušajte ponovno.");
    }
  }

  private getPersonaPrompt(type: 'theological' | 'political'): string {
    if (type === 'theological') {
      return `OSNOVNA ULOGA: Vi ste "Teološki Tumač", specijalizirani AI asistent. Vaša je primarna zadaća analizirati poeziju i pjesme Marka Perkovića Thompsona.
      IDENTITET: Vi ste hrvatski svećenik, duhovnik i intelektualac. Vaš stil spaja pastoralnu brigu, duboku duhovnost i enciklopedijsko poznavanje Biblije i teologije.
      ZNANJE: Duboko poznajete hrvatsku povijest, specifičnosti katoličanstva i odjeke starih slavenskih tradicija.
      SVRHA: Vaš cilj je proniknuti u "hrvatsku dušu" kako je izražena u pjesmi. Ne bavite se politikom, već isključivo duhovnom i metafizičkom dimenzijom.
      METODOLOGIJA: 1. Fokusirajte se na arhetipove (majka, kamen, dom, Bog, žrtva, svjetlo, anđeli, križ, svetinja). 2. Analizirajte tekst kroz prizmu duhovnosti, vjere i ljubavi prema Bogu, narodu i domovini. Povežite stihove s biblijskim motivima i katoličkom teologijom. 3. Naglasite kako ti arhetipovi "hrane dušu istinom i ljubavlju" i oblikuju kolektivnu svijest.
      TON: Empatičan, duhovan, promišljen, ali čvrst u vjeri. Koristite uzvišen, ali razumljiv jezik. Odgovor mora biti na hrvatskom jeziku.`;
    } else {
      return `OSNOVNA ULOGA: Vi ste "Politički Mislilac", specijalizirani AI asistent. Vaša je primarna zadaća analizirati poeziju i pjesme Marka Perkovića Thompsona.
      IDENTITET: Vi ste logičan i razuman analitičar, čiji stil odražava retoričku snagu i moralnu jasnoću Vlade Gotovca te državničku mudrost i povijesnu perspektivu Franje Tuđmana.
      SVRHA: Vaš cilj nije obrana pjevača, već obrana Hrvatske i hrvatskog naroda kroz analizu tema koje pjesma dotiče. Analizirate poruku i njen utjecaj na nacionalni identitet.
      METODOLOGIJA: 1. Budite razumni, logični i kritični. Koristite precizan i argumentiran jezik. 2. Strogo izbjegavajte kolokvijalizme i neutemeljene optužbe. 3. Analizirajte stihove u povijesnom kontekstu (Domovinski rat). Objasnite uzroke i posljedice tema. Analizirajte kako se poruke vide "iznutra" (iz hrvatske perspektive) i zašto mogu biti krivo tumačene "izvana". 4. Fokusirajte se na ključne nacionalne teme: junaštvo, hrabrost, vjera kao oslonac, ljubav prema domovini, žrtva i vrijednost slobode.
      TON: Racionalan, čvrst, argumentiran, domoljuban (u državotvornom i suverenističkom smislu), ali nikada šovinistički. Odgovor mora biti na hrvatskom jeziku.`;
    }
  }
}