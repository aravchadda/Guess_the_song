import { fuzzyMatch, normalizeString, getMatchScore } from '../utils/fuzzyMatch';

describe('fuzzyMatch', () => {
  describe('normalizeString', () => {
    it('should convert to lowercase', () => {
      expect(normalizeString('Hello World')).toBe('hello world');
    });
    
    it('should replace & with and', () => {
      expect(normalizeString('Tom & Jerry')).toBe('tom and jerry');
    });
    
    it('should remove punctuation', () => {
      expect(normalizeString("Don't Stop Believin'")).toBe('don t stop believin');
    });
    
    it('should normalize spaces', () => {
      expect(normalizeString('Hello    World')).toBe('hello world');
    });
  });
  
  describe('exact matches', () => {
    it('should match exact song name', () => {
      expect(fuzzyMatch('Bohemian Rhapsody', 'Bohemian Rhapsody', 'Queen')).toBe(true);
    });
    
    it('should match with different case', () => {
      expect(fuzzyMatch('bohemian rhapsody', 'Bohemian Rhapsody', 'Queen')).toBe(true);
    });
    
    it('should match with punctuation differences', () => {
      expect(fuzzyMatch('dont stop believin', "Don't Stop Believin'", 'Journey')).toBe(true);
    });
  });
  
  describe('partial matches', () => {
    it('should match when guess contains song name', () => {
      expect(fuzzyMatch('Hotel California by Eagles', 'Hotel California', 'Eagles')).toBe(true);
    });
    
    it('should match with artist name included', () => {
      expect(fuzzyMatch('Queen Bohemian Rhapsody', 'Bohemian Rhapsody', 'Queen')).toBe(true);
    });
  });
  
  describe('fuzzy matches', () => {
    it('should match with minor typos', () => {
      expect(fuzzyMatch('Bohemian Rapsody', 'Bohemian Rhapsody', 'Queen')).toBe(true);
    });
    
    it('should match with missing letters', () => {
      expect(fuzzyMatch('Stairway to Heavn', 'Stairway to Heaven', 'Led Zeppelin')).toBe(true);
    });
  });
  
  describe('non-matches', () => {
    it('should not match completely different songs', () => {
      expect(fuzzyMatch('Africa', 'Bohemian Rhapsody', 'Queen')).toBe(false);
    });
    
    it('should not match empty string', () => {
      expect(fuzzyMatch('', 'Bohemian Rhapsody', 'Queen')).toBe(false);
    });
    
    it('should not match very short strings', () => {
      expect(fuzzyMatch('ab', 'Bohemian Rhapsody', 'Queen')).toBe(false);
    });
    
    it('should not match with too many differences', () => {
      expect(fuzzyMatch('xyz abc def', 'Bohemian Rhapsody', 'Queen')).toBe(false);
    });
  });
  
  describe('real world examples', () => {
    it('should match "satisfaction rolling stones"', () => {
      expect(fuzzyMatch(
        'satisfaction rolling stones',
        "(I Can't Get No) Satisfaction - Mono",
        'The Rolling Stones'
      )).toBe(true);
    });
    
    it('should match "africa toto"', () => {
      expect(fuzzyMatch('africa toto', 'Africa', 'TOTO')).toBe(true);
    });
    
    it('should match "hey jude"', () => {
      expect(fuzzyMatch('hey jude', 'Hey Jude (Remastered 2015)', 'The Beatles')).toBe(true);
    });
    
    it('should match "imagine john lennon"', () => {
      expect(fuzzyMatch('imagine john lennon', 'Imagine (Ultimate Mix)', 'John Lennon')).toBe(true);
    });
  });
  
  describe('getMatchScore', () => {
    it('should return higher scores for better matches', () => {
      const exactScore = getMatchScore('Bohemian Rhapsody', 'Bohemian Rhapsody', 'Queen');
      const typoScore = getMatchScore('Bohemian Rapsody', 'Bohemian Rhapsody', 'Queen');
      const wrongScore = getMatchScore('Africa', 'Bohemian Rhapsody', 'Queen');
      
      expect(exactScore).toBeGreaterThan(typoScore);
      expect(typoScore).toBeGreaterThan(wrongScore);
    });
  });
});

