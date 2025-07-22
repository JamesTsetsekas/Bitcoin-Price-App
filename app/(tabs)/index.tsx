import React, { useState, useEffect } from 'react';
import { StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

interface BitcoinPrice {
  bitcoin: {
    usd: number;
  };
}

interface BitcoinHistoricalData {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

interface BitcoinPerformanceData {
  currentPrice: number;
  previousPrice: number;
  priceChange: number;
  priceChangePercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  marketCap: number;
  yearlyChange: number;
  yearlyChangePercent: number;
  priceOneYearAgo: number;
}

export default function HomeScreen() {
  const [price, setPrice] = useState<number | null>(null);
  const [previousPrice, setPreviousPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [priceColor, setPriceColor] = useState<string | null>(null);
  const [performanceData, setPerformanceData] = useState<BitcoinPerformanceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const screenWidth = Dimensions.get('window').width;

  const fetchBitcoinData = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
      }
      setError(null);
      
      // Fetch 1-year historical data which includes current price data
      // This reduces API calls from 3 to 1 per update
      const yearlyResponse = await fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365');
      const yearlyData: BitcoinHistoricalData = await yearlyResponse.json();
      
      if (!yearlyData.prices || yearlyData.prices.length === 0) {
        throw new Error('No historical data available');
      }
      
      // Get the latest data points (current price is the last entry)
      const prices = yearlyData.prices;
      const marketCaps = yearlyData.market_caps;
      const volumes = yearlyData.total_volumes;
      
      // Current price is the most recent price point
      const newPrice = prices[prices.length - 1][1];
      
      // Calculate 24h high/low from the last 48 data points (last ~24 hours)
      const last24hPrices = prices.slice(-48);
      const high24h = Math.max(...last24hPrices.map(p => p[1]));
      const low24h = Math.min(...last24hPrices.map(p => p[1]));
      
      // Get previous price (24 hours ago approximately)
      const previousPriceValue = prices.length > 48 ? prices[prices.length - 48][1] : prices[prices.length - 2][1];
      const priceChange = newPrice - previousPriceValue;
      const priceChangePercent = (priceChange / previousPriceValue) * 100;
      
      // Calculate yearly performance (first price point is ~1 year ago)
      const priceOneYearAgo = prices[0][1];
      const yearlyChange = newPrice - priceOneYearAgo;
      const yearlyChangePercent = (yearlyChange / priceOneYearAgo) * 100;
      
      // Get latest market cap and volume
      const latestMarketCap = marketCaps[marketCaps.length - 1][1];
      const latestVolume = volumes[volumes.length - 1][1];
      
      const newPerformanceData: BitcoinPerformanceData = {
        currentPrice: newPrice,
        previousPrice: previousPriceValue,
        priceChange: priceChange,
        priceChangePercent: priceChangePercent,
        high24h: high24h,
        low24h: low24h,
        volume24h: latestVolume,
        marketCap: latestMarketCap,
        yearlyChange: yearlyChange,
        yearlyChangePercent: yearlyChangePercent,
        priceOneYearAgo: priceOneYearAgo
      };
      
      // Compare with previous price and set color
      if (price !== null && newPrice !== price) {
        if (newPrice > price) {
          setPriceColor('#22C55E'); // Green for price increase
        } else if (newPrice < price) {
          setPriceColor('#EF4444'); // Red for price decrease
        }
        
        // Reset color after 2 seconds
        setTimeout(() => {
          setPriceColor(null);
        }, 2000);
      }
      
      setPreviousPrice(price);
      setPrice(newPrice);
      setPerformanceData(newPerformanceData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching Bitcoin data:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch data');
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchBitcoinData(true); // Initial load with loading state
    
    // Auto-refresh every 2 minutes to stay within rate limits
    // 12 requests per minute = 1 request every 5 seconds
    // But we'll be more conservative: 1 request every 2 minutes (30 requests/hour)
    const interval = setInterval(() => fetchBitcoinData(false), 120000); // 2 minutes = 120,000ms
    
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatLargeNumber = (num: number) => {
    if (num >= 1e12) {
      return (num / 1e12).toFixed(2) + 'T';
    } else if (num >= 1e9) {
      return (num / 1e9).toFixed(2) + 'B';
    } else if (num >= 1e6) {
      return (num / 1e6).toFixed(1) + 'M';
    } else if (num >= 1e3) {
      return (num / 1e3).toFixed(1) + 'K';
    }
    return num.toFixed(0);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Dynamic font size based on screen width and price length
  const getPriceFontSize = () => {
    if (!price) return 48;
    const priceText = formatPrice(price);
    const baseSize = screenWidth * 0.12;
    const adjustedSize = Math.min(baseSize, screenWidth / (priceText.length * 0.6));
    return Math.max(adjustedSize, 32);
  };

  const getPriceChangeColor = () => {
    if (!performanceData) return undefined;
    return performanceData.priceChange >= 0 ? '#22C55E' : '#EF4444';
  };

  const getPriceChangeText = () => {
    if (!performanceData) return '';
    const sign = performanceData.priceChange >= 0 ? '+' : '';
    return `${sign}${formatPrice(performanceData.priceChange)} (${sign}${performanceData.priceChangePercent.toFixed(2)}%)`;
  };

  const getYearlyChangeColor = () => {
    if (!performanceData) return undefined;
    return performanceData.yearlyChange >= 0 ? '#22C55E' : '#EF4444';
  };

  const getYearlyChangeText = () => {
    if (!performanceData) return '';
    const sign = performanceData.yearlyChange >= 0 ? '+' : '';
    return `${sign}${performanceData.yearlyChangePercent.toFixed(2)}%`;
  };

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <ThemedView style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>Error loading Bitcoin data</ThemedText>
          <ThemedText style={styles.errorDetail}>{error}</ThemedText>
          <ThemedText style={styles.retryText}>Retrying in 2 minutes...</ThemedText>
        </ThemedView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.priceContainer}>
        <ThemedText style={styles.bitcoinLabel}>₿ Bitcoin</ThemedText>
        
        {loading ? (
          <ActivityIndicator size="large" color="#F7931A" style={styles.loader} />
        ) : (
          <>
            <ThemedText style={[
              styles.priceText, 
              { fontSize: getPriceFontSize() },
              priceColor && { color: priceColor }
            ]}>
              {price ? formatPrice(price) : 'N/A'}
            </ThemedText>
            
            {performanceData && (
              <ThemedView style={styles.changeContainer}>
                <ThemedView style={styles.performanceRow}>
                  <ThemedView style={styles.performanceItem}>
                    <ThemedText style={[
                      styles.changeText,
                      { color: getPriceChangeColor() }
                    ]}>
                      {getPriceChangeText()}
                    </ThemedText>
                    <ThemedText style={styles.timeLabel}>24h Change</ThemedText>
                  </ThemedView>
                  
                  <ThemedView style={styles.performanceItem}>
                    <ThemedText style={[
                      styles.yearlyChangeText,
                      { color: getYearlyChangeColor() }
                    ]}>
                      {getYearlyChangeText()}
                    </ThemedText>
                    <ThemedText style={styles.timeLabel}>1Y Performance</ThemedText>
                  </ThemedView>
                </ThemedView>
              </ThemedView>
            )}
            
            {performanceData && (
              <ThemedView style={styles.statsContainer}>
                <ThemedView style={styles.statRow}>
                  <ThemedText style={styles.statLabel}>24h High:</ThemedText>
                  <ThemedText style={styles.statValue}>{formatPrice(performanceData.high24h)}</ThemedText>
                </ThemedView>
                <ThemedView style={styles.statRow}>
                  <ThemedText style={styles.statLabel}>24h Low:</ThemedText>
                  <ThemedText style={styles.statValue}>{formatPrice(performanceData.low24h)}</ThemedText>
                </ThemedView>
                <ThemedView style={styles.statRow}>
                  <ThemedText style={styles.statLabel}>24h Volume:</ThemedText>
                  <ThemedText style={styles.statValue}>${formatLargeNumber(performanceData.volume24h)}</ThemedText>
                </ThemedView>
                <ThemedView style={styles.statRow}>
                  <ThemedText style={styles.statLabel}>Market Cap:</ThemedText>
                  <ThemedText style={styles.statValue}>${formatLargeNumber(performanceData.marketCap)}</ThemedText>
                </ThemedView>
                <ThemedView style={styles.statRow}>
                  <ThemedText style={styles.statLabel}>Price 1Y Ago:</ThemedText>
                  <ThemedText style={styles.statValue}>{formatPrice(performanceData.priceOneYearAgo)}</ThemedText>
                </ThemedView>
              </ThemedView>
            )}
          </>
        )}
        
        {lastUpdated && (
          <ThemedText style={styles.lastUpdated}>
            Last updated: {formatTime(lastUpdated)}
          </ThemedText>
        )}
      </ThemedView>
      
      <ThemedText style={styles.footer}>
        Auto-refreshes every 2 minutes
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  priceContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: 10,
  },
  bitcoinLabel: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#F7931A',
  },
  priceText: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    paddingHorizontal: 10,
    lineHeight: undefined, // Let the system calculate optimal line height
  },
  changeContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
  },
  performanceItem: {
    alignItems: 'center',
    flex: 1,
  },
  changeText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  yearlyChangeText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  timeLabel: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 2,
  },
  statsContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
    width: '100%',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  statLabel: {
    fontSize: 16,
    opacity: 0.8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  loader: {
    marginVertical: 40,
  },
  lastUpdated: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 10,
    textAlign: 'center',
  },
  errorDetail: {
    fontSize: 16,
    opacity: 0.8,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryText: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
  },
});
