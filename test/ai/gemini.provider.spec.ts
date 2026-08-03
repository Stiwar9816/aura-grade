import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { GeminiProvider } from 'src/ai/providers/gemini.provider';

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: jest.fn(),
    },
  })),
}));

describe('GeminiProvider', () => {
  const apiKey = 'test-gemini-api-key';
  const config = {
    getOrThrow: jest.fn().mockReturnValue(apiKey),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    (config.getOrThrow as jest.Mock).mockReturnValue(apiKey);
  });

  it('initializes the SDK with the configured API key', () => {
    new GeminiProvider(config);

    expect(config.getOrThrow).toHaveBeenCalledWith('GEMINI_API_KEY');
    expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey });
  });

  it('requests a structured evaluation from the configured model', async () => {
    const provider = new GeminiProvider(config);
    const client = (GoogleGenAI as jest.Mock).mock.results[0].value;
    client.models.generateContent.mockResolvedValue({
      text: JSON.stringify({
        totalScore: 4.5,
        generalFeedback: 'Buen trabajo.',
        detailedFeedback: [],
      }),
    });

    await expect(provider.evaluateSubmission('Contenido', [], 'Ensayo final')).resolves.toEqual({
      totalScore: 4.5,
      generalFeedback: 'Buen trabajo.',
      detailedFeedback: [],
    });
    expect(client.models.generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-3.5-flash',
        config: { responseMimeType: 'application/json' },
      })
    );
  });
});
