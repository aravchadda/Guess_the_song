import { formatViewCount } from '../utils/viewCountFormatter';

describe('formatViewCount', () => {
  it('should format billions with one decimal', () => {
    expect(formatViewCount(1_500_000_000)).toBe('1.5B');
    expect(formatViewCount(2_300_000_000)).toBe('2.3B');
  });
  
  it('should format millions as rounded M', () => {
    expect(formatViewCount(1_500_000)).toBe('2M');
    expect(formatViewCount(1_200_000)).toBe('1M');
    expect(formatViewCount(999_999)).toBe('1M');
  });
  
  it('should format thousands as rounded K', () => {
    expect(formatViewCount(5_000)).toBe('5K');
    expect(formatViewCount(1_500)).toBe('2K');
  });
  
  it('should return raw number for values under 1000', () => {
    expect(formatViewCount(500)).toBe('500');
    expect(formatViewCount(999)).toBe('999');
  });
  
  it('should handle exact boundaries', () => {
    expect(formatViewCount(1_000_000_000)).toBe('1.0B');
    expect(formatViewCount(1_000_000)).toBe('1M');
    expect(formatViewCount(1_000)).toBe('1K');
  });
});

