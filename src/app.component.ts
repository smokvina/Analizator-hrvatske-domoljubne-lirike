import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { GeminiService, SongInfo } from './services/gemini.service';
import { LoadingSpinnerComponent } from './components/loading-spinner/loading-spinner.component';
import { CommonModule } from '@angular/common';

type AppState = 'initial' | 'song_identified' | 'analyzing' | 'analysis_complete' | 'history';
type AnalysisType = 'theological' | 'political';

interface SavedAnalysis {
  songInfo: SongInfo;
  analysisType: AnalysisType;
  analysisResult: string;
  timestamp: number;
}


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LoadingSpinnerComponent]
})
export class AppComponent {
  private geminiService = inject(GeminiService);

  // State Signals
  appState = signal<AppState>('initial');
  userInput = signal<string>('');
  songInfo = signal<SongInfo | null>(null);
  analysisType = signal<AnalysisType | null>(null);
  analysisResult = signal<string>('');
  generatedImage = signal<string | null>(null);
  isLoading = signal<boolean>(false);
  isLoadingImage = signal<boolean>(false);
  errorMessage = signal<string>('');
  analysisStatus = signal<string>('Analiziram pjesmu...');
  
  // History signals
  history = signal<SavedAnalysis[]>([]);
  isCurrentAnalysisSaved = signal<boolean>(false);

  constructor() {
    this.loadHistory();
  }

  private loadHistory(): void {
    if (typeof localStorage !== 'undefined') {
      const savedHistory = localStorage.getItem('analysisHistory');
      if (savedHistory) {
        try {
          this.history.set(JSON.parse(savedHistory));
        } catch (e) {
          console.error('Error parsing history from localStorage', e);
          localStorage.removeItem('analysisHistory');
        }
      }
    }
  }

  async handleInitialAnalysis(): Promise<void> {
    if (this.userInput().trim().length === 0) return;

    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const info = await this.geminiService.identifySong(this.userInput());
      this.songInfo.set(info);
      this.appState.set('song_identified');
    } catch (error) {
      console.error('Error identifying song:', error);
      this.errorMessage.set(error instanceof Error ? error.message : 'Došlo je do nepoznate greške pri identifikaciji pjesme.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async performAnalysis(type: AnalysisType): Promise<void> {
    const currentSongInfo = this.songInfo();
    if (!currentSongInfo) return;

    this.analysisType.set(type);
    this.appState.set('analyzing');
    this.isLoading.set(true);
    this.isLoadingImage.set(true);
    this.errorMessage.set('');
    this.analysisResult.set('');
    this.generatedImage.set(null);
    this.isCurrentAnalysisSaved.set(false);

    try {
      // Start analysis
      this.analysisStatus.set(`Generiram ${type === 'theological' ? 'teološku' : 'političku'} analizu...`);
      const analysisText = await this.geminiService.generateAnalysis(currentSongInfo, type);
      this.analysisResult.set(analysisText);
      this.appState.set('analysis_complete');
      this.isLoading.set(false);

      // Start image generation after analysis is complete
      this.analysisStatus.set('Generiram umjetničku vizualizaciju...');
      const imageUrl = await this.geminiService.generateImageForSong(currentSongInfo.title, analysisText);
      this.generatedImage.set(imageUrl);

    } catch (error) {
      console.error('Error during analysis or image generation:', error);
      this.errorMessage.set(error instanceof Error ? error.message : 'Došlo je do greške tijekom generiranja analize ili slike.');
      this.appState.set('song_identified'); // Go back to selection
    } finally {
      this.isLoading.set(false);
      this.isLoadingImage.set(false);
    }
  }

  reset(): void {
    this.appState.set('initial');
    this.userInput.set('');
    this.songInfo.set(null);
    this.analysisType.set(null);
    this.analysisResult.set('');
    this.generatedImage.set(null);
    this.isLoading.set(false);
    this.isLoadingImage.set(false);
    this.errorMessage.set('');
    this.isCurrentAnalysisSaved.set(false);
  }

  saveAnalysis(): void {
    const song = this.songInfo();
    const type = this.analysisType();
    const result = this.analysisResult();

    if (!song || !type || !result) {
      this.errorMessage.set('Nije moguće spremiti analizu, nedostaju podaci.');
      return;
    }
    
    const newAnalysis: SavedAnalysis = {
      songInfo: song,
      analysisType: type,
      analysisResult: result,
      timestamp: Date.now()
    };

    this.history.update(currentHistory => [newAnalysis, ...currentHistory]);
    
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('analysisHistory', JSON.stringify(this.history()));
    }
    
    this.isCurrentAnalysisSaved.set(true);
  }

  showHistory(): void {
    this.appState.set('history');
  }

  clearHistory(): void {
    if (confirm('Jeste li sigurni da želite obrisati cijelu povijest? Ova akcija je nepovratna.')) {
        this.history.set([]);
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('analysisHistory');
        }
    }
  }
}