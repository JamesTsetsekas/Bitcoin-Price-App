import React, { useState, useEffect } from 'react';
import { StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import Constants from 'expo-constants';

// Using Alpha Vantage API to fetch MSTR stock data
const ALPHA_VANTAGE_API_KEY = Constants.expoConfig?.extra?.alphaVantageApiKey || process.env.EXPO_PUBLIC_ALPHA_VANTAGE_API_KEY;

if (!ALPHA_VANTAGE_API_KEY) {
  console.warn('Alpha Vantage API key not found. Please check your .env file.');
}

interface AlphaVantageResponse {
  'Meta Data': {
    '1. Information': string;
    '2. Symbol': string;
    '3. Last Refreshed': string;
    '4. Output Size': string;
    '5. Time Zone': string;
  };
  'Time Series (Daily)': {
    [key: string]: {
      '1. open': string;
      '2. high': string;
      '3. low': string;
      '4. close': string;
      '5. volume': string;
    };
  };
}

interface MSTRData {
  symbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  volume: string;
  lastRefreshed: string;
  priceChange: number;
  priceChangePercent: number;
}

export default function StrategyScreen() {
  const [mstrData, setMstrData] = useState<MSTRData | null>(null);
  const [previousPrice, setPreviousPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [priceColor, setPriceColor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const screenWidth = Dimensions.get('window').width;

  const fetchMSTRData = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
      }
      setError(null);
      
      const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=MSTR&apikey=${ALPHA_VANTAGE_API_KEY}`;
      
      const response = await fetch(url);
      const data: AlphaVantageResponse = await response.json();
      
      // Check if API returned an error
      if ('Error Message' in data) {
        throw new Error('Invalid API call or symbol not found');
      }
      
      if ('Note' in data) {
        throw new Error('API call frequency limit reached');
      }
      
      const timeSeries = data['Time Series (Daily)'];
      if (!timeSeries) {
        throw new Error('No time series data available');
      }
      
      // Get the most recent data point (latest trading day)
      const latestDate = Object.keys(timeSeries)[0];
      const latestData = timeSeries[latestDate];
      
      // Get previous day's data for comparison
      const dates = Object.keys(timeSeries);
      const previousDate = dates[1]; // Second most recent date
      const previousData = timeSeries[previousDate];
      
      const currentPrice = parseFloat(latestData['4. close']);
      const previousClose = previousData ? parseFloat(previousData['4. close']) : parseFloat(latestData['1. open']);
      const priceChange = currentPrice - previousClose;
      const priceChangePercent = (priceChange / previousClose) * 100;
      
      const newMstrData: MSTRData = {
        symbol: data['Meta Data']['2. Symbol'],
        price: currentPrice,
        open: parseFloat(latestData['1. open']),
        high: parseFloat(latestData['2. high']),
        low: parseFloat(latestData['3. low']),
        volume: latestData['5. volume'],
        lastRefreshed: data['Meta Data']['3. Last Refreshed'],
        priceChange: priceChange,
        priceChangePercent: priceChangePercent
      };
      
      // Compare with previous price and set color
      if (previousPrice !== null && currentPrice !== previousPrice) {
        if (currentPrice > previousPrice) {
          setPriceColor('#22C55E'); // Green for price increase
        } else if (currentPrice < previousPrice) {
          setPriceColor('#EF4444'); // Red for price decrease
        }
        
        // Reset color after 2 seconds
        setTimeout(() => {
          setPriceColor(null);
        }, 2000);
      }
      
      setPreviousPrice(currentPrice);
      setMstrData(newMstrData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching MSTR data:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch data');
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchMSTRData(true); // Initial load with loading state
    
    // Auto-refresh every 5 minutes (daily data doesn't change frequently)
    const interval = setInterval(() => fetchMSTRData(false), 300000);
    
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

  const formatVolume = (volume: string) => {
    const num = parseInt(volume);
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
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
    if (!mstrData) return 48;
    const priceText = formatPrice(mstrData.price);
    const baseSize = screenWidth * 0.12;
    const adjustedSize = Math.min(baseSize, screenWidth / (priceText.length * 0.6));
    return Math.max(adjustedSize, 32);
  };

  const getPriceChangeColor = () => {
    if (!mstrData) return undefined;
    return mstrData.priceChange >= 0 ? '#22C55E' : '#EF4444';
  };

  const getPriceChangeText = () => {
    if (!mstrData) return '';
    const sign = mstrData.priceChange >= 0 ? '+' : '';
    return `${sign}${formatPrice(mstrData.priceChange)} (${sign}${mstrData.priceChangePercent.toFixed(2)}%)`;
  };

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <ThemedView style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>Error loading MSTR data</ThemedText>
          <ThemedText style={styles.errorDetail}>{error}</ThemedText>
          <ThemedText style={styles.retryText}>Retrying in 60 seconds...</ThemedText>
        </ThemedView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.priceContainer}>
        <ThemedText style={styles.stockLabel}>📈 MicroStrategy</ThemedText>
        <ThemedText style={styles.tickerLabel}>MSTR</ThemedText>
        
        {loading ? (
          <ActivityIndicator size="large" color="#0066CC" style={styles.loader} />
        ) : (
          <>
            <ThemedText style={[
              styles.priceText, 
              { fontSize: getPriceFontSize() },
              priceColor && { color: priceColor }
            ]}>
              {mstrData ? formatPrice(mstrData.price) : 'N/A'}
            </ThemedText>
            
            {mstrData && (
              <ThemedView style={styles.changeContainer}>
                <ThemedText style={[
                  styles.changeText,
                  { color: getPriceChangeColor() }
                ]}>
                  {getPriceChangeText()}
                </ThemedText>
              </ThemedView>
            )}
            
            {mstrData && (
              <ThemedView style={styles.statsContainer}>
                <ThemedView style={styles.statRow}>
                  <ThemedText style={styles.statLabel}>Open:</ThemedText>
                  <ThemedText style={styles.statValue}>{formatPrice(mstrData.open)}</ThemedText>
                </ThemedView>
                <ThemedView style={styles.statRow}>
                  <ThemedText style={styles.statLabel}>High:</ThemedText>
                  <ThemedText style={styles.statValue}>{formatPrice(mstrData.high)}</ThemedText>
                </ThemedView>
                <ThemedView style={styles.statRow}>
                  <ThemedText style={styles.statLabel}>Low:</ThemedText>
                  <ThemedText style={styles.statValue}>{formatPrice(mstrData.low)}</ThemedText>
                </ThemedView>
                <ThemedView style={styles.statRow}>
                  <ThemedText style={styles.statLabel}>Volume:</ThemedText>
                  <ThemedText style={styles.statValue}>{formatVolume(mstrData.volume)}</ThemedText>
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
        
        {mstrData && (
          <ThemedText style={styles.marketData}>
            Market data: {mstrData.lastRefreshed}
          </ThemedText>
        )}
      </ThemedView>
      
      <ThemedText style={styles.footer}>
        Auto-refreshes every 5 minutes
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
  stockLabel: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#0066CC',
  },
  tickerLabel: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 30,
    opacity: 0.8,
  },
  priceText: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    paddingHorizontal: 10,
    lineHeight: undefined,
  },
  changeContainer: {
    marginBottom: 20,
  },
  changeText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
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
  marketData: {
    fontSize: 12,
    opacity: 0.5,
    textAlign: 'center',
    marginTop: 5,
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
