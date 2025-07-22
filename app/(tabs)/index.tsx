import React, { useState, useEffect } from 'react';
import { StyleSheet, ActivityIndicator, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
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

interface ChartData {
  labels: string[];
  datasets: [{
    data: number[];
  }];
}

type TimeInterval = '1D' | '1W' | '1M' | '1Y' | 'ALL';

export default function HomeScreen() {
  const [price, setPrice] = useState<number | null>(null);
  const [previousPrice, setPreviousPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [priceColor, setPriceColor] = useState<string | null>(null);
  const [performanceData, setPerformanceData] = useState<BitcoinPerformanceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<TimeInterval>('1D');
  const [chartLoading, setChartLoading] = useState<boolean>(false);
  const screenWidth = Dimensions.get('window').width;

  const fetchChartData = async (interval: TimeInterval) => {
    try {
      setChartLoading(true);
      
      let chartData: ChartData;
      
      if (interval === '1D') {
        // Use Gemini API for 24h data (1D chart) - this provides perfect 24h hourly data
        try {
          const response = await fetch('https://api.gemini.com/v2/ticker/btcusd');
          const data = await response.json();
          
          if (data.changes && data.changes.length > 0) {
            // Gemini gives us hourly prices for last 24 hours (descending)
            const prices = data.changes.reverse(); // Make it ascending (oldest to newest)
            const labels = prices.map((_, index) => {
              const hoursAgo = 23 - index;
              if (hoursAgo === 0) return 'Now';
              if (hoursAgo % 6 === 0) return `${hoursAgo}h`; // Show every 6 hours for cleaner labels
              return ''; // Empty label for other hours
            });
            
            chartData = {
              labels: labels,
              datasets: [{
                data: prices.map(price => parseFloat(price))
              }]
            };
          } else {
            throw new Error('No Gemini data available');
          }
        } catch (geminiError) {
          console.log('Gemini API failed, falling back to CoinGecko for 1D');
          // Fallback to CoinGecko for 1D
          const response = await fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1');
          const data: BitcoinHistoricalData = await response.json();
          
          if (!data.prices || data.prices.length === 0) {
            throw new Error('No chart data available');
          }
          
          // Process CoinGecko data for 1D
          const step = Math.max(1, Math.ceil(data.prices.length / 12));
          const processedPrices = data.prices.filter((_, index) => index % step === 0);
          const labels = processedPrices.map((item) => {
            const date = new Date(item[0]);
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          });
          
          chartData = {
            labels: labels,
            datasets: [{
              data: processedPrices.map(item => item[1])
            }]
          };
        }
      } else {
        // Use CoinGecko for other intervals (1W, 1M, 1Y, ALL)
        const dayMap = {
          '1W': '7',
          '1M': '30',
          '1Y': '365',
          'ALL': 'max'
        };
        
        const days = dayMap[interval];
        const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`;
        
        const response = await fetch(url);
        const data: BitcoinHistoricalData = await response.json();
        
        if (!data.prices || data.prices.length === 0) {
          throw new Error('No chart data available');
        }
        
        let processedPrices = data.prices;
        let labels: string[] = [];
        
        if (interval === '1W') {
          // For 1W, show daily points - verify data makes sense
          console.log('1W Raw data length:', processedPrices.length);
          console.log('1W First timestamp:', processedPrices[0][0], '-> Date:', new Date(processedPrices[0][0]).toISOString());
          console.log('1W Last timestamp:', processedPrices[processedPrices.length - 1][0], '-> Date:', new Date(processedPrices[processedPrices.length - 1][0]).toISOString());
          console.log('1W Price range:', Math.min(...processedPrices.map(p => p[1])), 'to', Math.max(...processedPrices.map(p => p[1])));
          
          const step = Math.max(1, Math.ceil(processedPrices.length / 10)); // Show ~10 points for better distribution
          processedPrices = processedPrices.filter((_, index) => index % step === 0);
          labels = processedPrices.map((item) => {
            const date = new Date(item[0]);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          });
        } else if (interval === '1M') {
          // For 1M, show weekly points
          const step = Math.max(1, Math.ceil(processedPrices.length / 8)); // Show ~8 points
          processedPrices = processedPrices.filter((_, index) => index % step === 0);
          labels = processedPrices.map((item) => {
            const date = new Date(item[0]);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          });
        } else if (interval === '1Y') {
          // For 1Y, show monthly points
          const step = Math.max(1, Math.ceil(processedPrices.length / 12)); // Show ~12 points
          processedPrices = processedPrices.filter((_, index) => index % step === 0);
          labels = processedPrices.map((item) => {
            const date = new Date(item[0]);
            return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
          });
        } else { // ALL
          // For ALL, show yearly points
          const step = Math.max(1, Math.ceil(processedPrices.length / 15)); // Show ~15 points
          processedPrices = processedPrices.filter((_, index) => index % step === 0);
          labels = processedPrices.map((item) => {
            const date = new Date(item[0]);
            return date.getFullYear().toString();
          });
        }
        
        chartData = {
          labels: labels,
          datasets: [{
            data: processedPrices.map(item => item[1])
          }]
        };
      }
      
      setChartData(chartData);
    } catch (error) {
      console.error('Error fetching chart data:', error);
      setChartData(null);
    } finally {
      setChartLoading(false);
    }
  };

  const fetchBitcoinData = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
      }
      setError(null);
      
      // Fetch comprehensive Bitcoin data including 24h metrics
      const detailedResponse = await fetch('https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false');
      const detailedData = await detailedResponse.json();
      
      if (!detailedData.market_data) {
        throw new Error('Market data not available');
      }
      
      const marketData = detailedData.market_data;
      const newPrice = marketData.current_price.usd;
      const priceChange = marketData.price_change_24h || 0;
      const priceChangePercent = marketData.price_change_percentage_24h || 0;
      const high24h = marketData.high_24h.usd;
      const low24h = marketData.low_24h.usd;
      const volume24h = marketData.total_volume.usd;
      const marketCap = marketData.market_cap.usd;
      
      // Fetch 1-year historical data for yearly performance
      const yearlyResponse = await fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365');
      const yearlyData: BitcoinHistoricalData = await yearlyResponse.json();
      
      if (!yearlyData.prices || yearlyData.prices.length === 0) {
        throw new Error('No historical data available');
      }
      
      // Calculate yearly performance (first price point is ~1 year ago)
      const priceOneYearAgo = yearlyData.prices[0][1];
      const yearlyChange = newPrice - priceOneYearAgo;
      const yearlyChangePercent = (yearlyChange / priceOneYearAgo) * 100;
      
      const newPerformanceData: BitcoinPerformanceData = {
        currentPrice: newPrice,
        previousPrice: newPrice - priceChange,
        priceChange: priceChange,
        priceChangePercent: priceChangePercent,
        high24h: high24h,
        low24h: low24h,
        volume24h: volume24h,
        marketCap: marketCap,
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
    fetchChartData(selectedInterval); // Initial chart load
    
    // Auto-refresh every 2 minutes to stay within rate limits
    const interval = setInterval(() => {
      fetchBitcoinData(false);
      fetchChartData(selectedInterval);
    }, 120000); // 2 minutes = 120,000ms
    
    return () => clearInterval(interval);
  }, []);

  // Fetch chart data when interval changes
  useEffect(() => {
    fetchChartData(selectedInterval);
  }, [selectedInterval]);

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
    const amount = Math.abs(performanceData.priceChange);
    let formattedAmount;
    if (amount >= 1000) {
      formattedAmount = `$${formatLargeNumber(amount)}`;
    } else {
      formattedAmount = `$${amount.toFixed(0)}`;
    }
    return `${sign}${formattedAmount} (${sign}${performanceData.priceChangePercent.toFixed(1)}%)`;
  };

  const getYearlyChangeText = () => {
    if (!performanceData) return '';
    const sign = performanceData.yearlyChange >= 0 ? '+' : '';
    const amount = Math.abs(performanceData.yearlyChange);
    let formattedAmount;
    if (amount >= 1000) {
      formattedAmount = `$${formatLargeNumber(amount)}`;
    } else {
      formattedAmount = formatPrice(performanceData.yearlyChange);
    }
    return `${sign}${formattedAmount} (${sign}${performanceData.yearlyChangePercent.toFixed(1)}%)`;
  };

  const getYearlyChangeColor = () => {
    if (!performanceData) return undefined;
    return performanceData.yearlyChange >= 0 ? '#22C55E' : '#EF4444';
  };

  const renderTimeIntervalButtons = () => {
    const intervals: TimeInterval[] = ['1D', '1W', '1M', '1Y', 'ALL'];
    
    return (
      <ThemedView style={styles.intervalContainer}>
        {intervals.map((interval) => (
          <TouchableOpacity
            key={interval}
            style={[
              styles.intervalButton,
              selectedInterval === interval && styles.intervalButtonActive
            ]}
            onPress={() => setSelectedInterval(interval)}
          >
            <ThemedText style={[
              styles.intervalButtonText,
              selectedInterval === interval && styles.intervalButtonTextActive
            ]}>
              {interval}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </ThemedView>
    );
  };

  const renderChart = () => {
    if (chartLoading) {
      return (
        <ThemedView style={styles.chartContainer}>
          <ActivityIndicator size="large" color="#F7931A" />
          <ThemedText style={styles.chartLoadingText}>Loading chart...</ThemedText>
        </ThemedView>
      );
    }

    if (!chartData || chartData.datasets[0].data.length === 0) {
      return (
        <ThemedView style={styles.chartContainer}>
          <ThemedText style={styles.chartErrorText}>Chart data unavailable</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.chartContainer}>
        <LineChart
          data={chartData}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            backgroundColor: 'transparent',
            backgroundGradientFrom: 'transparent',
            backgroundGradientTo: 'transparent',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(247, 147, 26, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(128, 128, 128, 0)`, // Make labels transparent
            style: {
              borderRadius: 16
            },
            propsForDots: {
              r: '0', // Remove dots completely
              strokeWidth: '0',
            },
            propsForLabels: {
              fontSize: 0 // Hide labels
            },
            fillShadowGradient: 'transparent',
            fillShadowGradientOpacity: 0,
          }}
          bezier
          style={styles.chart}
          withHorizontalLabels={false} // Remove horizontal labels
          withVerticalLabels={false}   // Remove vertical labels
          withDots={false}
          withShadow={false}
          withScrollableDot={false}
          withInnerLines={false}       // Remove grid lines
          withOuterLines={false}       // Remove outer lines
          withHorizontalLines={false}  // Remove horizontal grid lines
          withVerticalLines={false}    // Remove vertical grid lines
        />
      </ThemedView>
    );
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
    <ScrollView contentContainerStyle={styles.scrollContainer}>
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
                      <ThemedText 
                        style={[styles.changeText, { color: getPriceChangeColor() }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit={true}
                        minimumFontScale={0.5}
                        allowFontScaling={false}
                      >
                        {getPriceChangeText()}
                      </ThemedText>
                      <ThemedText style={styles.timeLabel}>24h Change</ThemedText>
                    </ThemedView>
                    
                    <ThemedView style={styles.performanceItem}>
                      <ThemedText 
                        style={[styles.yearlyChangeText, { color: getYearlyChangeColor() }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit={true}
                        minimumFontScale={0.5}
                        allowFontScaling={false}
                      >
                        {getYearlyChangeText()}
                      </ThemedText>
                      <ThemedText style={styles.timeLabel}>1Y Performance</ThemedText>
                    </ThemedView>
                  </ThemedView>
                </ThemedView>
              )}
            </>
          )}
        </ThemedView>

        {/* Chart Section */}
        <ThemedView style={styles.chartSection}>
          <ThemedText style={styles.chartTitle}>Price Chart</ThemedText>
          {renderTimeIntervalButtons()}
          {renderChart()}
        </ThemedView>

        {/* Stats Section */}
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
        
        {lastUpdated && (
          <ThemedText style={styles.lastUpdated}>
            Last updated: {formatTime(lastUpdated)}
          </ThemedText>
        )}
        
        <ThemedText style={styles.footer}>
          Auto-refreshes every 2 minutes
        </ThemedText>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  priceContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
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
    lineHeight: undefined,
  },
  changeContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '125%',
    paddingHorizontal: 0,
  },
  performanceItem: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
    minWidth: 0,
  },
  changeText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  yearlyChangeText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  timeLabel: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 2,
  },
  chartSection: {
    marginVertical: 20,
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  intervalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
    paddingHorizontal: 10,
    gap: 8,
  },
  intervalButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    minWidth: 40,
    alignItems: 'center',
  },
  intervalButtonActive: {
    backgroundColor: '#F7931A',
  },
  intervalButtonText: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.7,
  },
  intervalButtonTextActive: {
    color: 'white',
    opacity: 1,
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 220,
    width: '100%',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  chartLoadingText: {
    marginTop: 10,
    fontSize: 14,
    opacity: 0.6,
  },
  chartErrorText: {
    fontSize: 14,
    opacity: 0.6,
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
  footer: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
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
