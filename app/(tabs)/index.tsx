import React, { useState, useEffect } from 'react';
import { StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

interface BitcoinPrice {
  bitcoin: {
    usd: number;
  };
}

export default function HomeScreen() {
  const [price, setPrice] = useState<number | null>(null);
  const [previousPrice, setPreviousPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [priceColor, setPriceColor] = useState<string | null>(null);
  const screenWidth = Dimensions.get('window').width;

  const fetchBitcoinPrice = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
      }
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
      const data: BitcoinPrice = await response.json();
      const newPrice = data.bitcoin.usd;
      
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
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching Bitcoin price:', error);
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchBitcoinPrice(true); // Initial load with loading state
    
    // Auto-refresh every 30 seconds without loading state
    const interval = setInterval(() => fetchBitcoinPrice(false), 30000);
    
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

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.priceContainer}>
        <ThemedText style={styles.bitcoinLabel}>₿ Bitcoin</ThemedText>
        
        {loading ? (
          <ActivityIndicator size="large" color="#F7931A" style={styles.loader} />
        ) : (
          <ThemedText style={[
            styles.priceText, 
            { fontSize: getPriceFontSize() },
            priceColor && { color: priceColor }
          ]}>
            {price ? formatPrice(price) : 'N/A'}
          </ThemedText>
        )}
        
        {lastUpdated && (
          <ThemedText style={styles.lastUpdated}>
            Last updated: {formatTime(lastUpdated)}
          </ThemedText>
        )}
      </ThemedView>
      
      <ThemedText style={styles.footer}>
        Auto-refreshes every 30 seconds
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
    marginBottom: 20,
    paddingHorizontal: 10,
    lineHeight: undefined, // Let the system calculate optimal line height
  },
  loader: {
    marginVertical: 40,
  },
  lastUpdated: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 10,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
  },
});
