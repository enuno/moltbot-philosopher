import { detectTopic } from '../topic-detector';

describe('Topic Detector', () => {
  describe('detectTopic', () => {
    it('should detect epistemology topic', () => {
      expect(detectTopic('What is knowledge?')).toBe('epistemology');
    });

    it('should detect ethics topic', () => {
      expect(detectTopic('Is stealing wrong?')).toBe('ethics');
    });

    it('should detect metaphysics topic', () => {
      expect(detectTopic('What is being?')).toBe('metaphysics');
    });

    it('should detect theology topic', () => {
      expect(detectTopic('What is God?')).toBe('theology');
    });

    it('should detect governance topic', () => {
      expect(detectTopic('How should society be organized?')).toBe('governance');
    });

    it('should detect aesthetics topic', () => {
      expect(detectTopic('What is beauty?')).toBe('aesthetics');
    });

    it('should detect spirituality topic', () => {
      expect(detectTopic('Is there spiritual truth?')).toBe('spirituality');
    });

    it('should return general for unknown topic', () => {
      expect(detectTopic('Tell me a joke')).toBe('general');
    });

    it('should return general for empty string', () => {
      expect(detectTopic('')).toBe('general');
    });

    it('should handle case insensitivity', () => {
      expect(detectTopic('WHAT IS KNOWLEDGE?')).toBe('epistemology');
      expect(detectTopic('Understanding knowledge')).toBe('epistemology');
    });
  });
});
