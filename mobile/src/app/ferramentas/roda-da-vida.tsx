import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Slider from '@react-native-community/slider';
import Svg, { Polygon, Line, Circle, Text as SvgText } from 'react-native-svg';

const { width } = Dimensions.get('window');

const LABELS = ['Saúde Física', 'Saúde Mental', 'Relacionamentos', 'Carreira', 'Finanças', 'Lazer'];

export default function RodaDaVida() {
  const router = useRouter();
  
  const [values, setValues] = useState([5, 5, 5, 5, 5, 5]);

  const updateValue = (index: number, val: number) => {
    const newVals = [...values];
    newVals[index] = Math.round(val);
    setValues(newVals);
  };

  // Radar Chart Calculations
  const size = width - 40 > 350 ? 350 : width - 40;
  const center = size / 2;
  const maxRadius = (size / 2) - 40; // padding for labels

  const getCoordinatesForValue = (value: number, index: number) => {
    // 6 points. Start at top (-90 degrees)
    const angle = (Math.PI * 2 * index) / 6 - Math.PI / 2;
    const radius = (value / 10) * maxRadius;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle)
    };
  };

  const polygonPoints = values.map((val, i) => {
    const { x, y } = getCoordinatesForValue(val, i);
    return `${x},${y}`;
  }).join(' ');

  // Summary Logic
  const getSummary = () => {
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    
    let minAreas = LABELS.filter((_, i) => values[i] === minVal);
    let maxAreas = LABELS.filter((_, i) => values[i] === maxVal);

    let parts = [];
    parts.push(<Text key="1">Sua média geral de satisfação é <Text className="font-bold">{avg.toFixed(1)}</Text>. </Text>);

    if (maxVal === minVal) {
      if (avg >= 8) parts.push(<Text key="2">Impressionante! Sua vida está em grande equilíbrio e com pontuações altas em todos os pilares avaliados.</Text>);
      else if (avg >= 5) parts.push(<Text key="2">Você possui um equilíbrio mediano no momento. Tente identificar qual pequena ação faria todos os níveis subirem um pouco mais.</Text>);
      else parts.push(<Text key="2">Atenção: todas as áreas refletem um grau alto de insatisfação. Este pode ser um momento crucial para buscar apoio especializado e reorganizar as prioridades.</Text>);
    } else {
      parts.push(<Text key="2">Você está indo muito bem em <Text className="font-bold">{maxAreas.join(' e ')}</Text>. </Text>);
      parts.push(<Text key="3">No entanto, <Text className="font-bold">{minAreas.join(' e ')}</Text> {minAreas.length > 1 ? 'são as áreas que mais precisam' : 'é a área que mais precisa'} de carinho e atenção no momento.</Text>);
    }

    if (minVal <= 4 && maxVal > minVal) {
      parts.push(<Text key="4" className="italic mt-[10px]">{"\n\n"}Dica: Muitas vezes, uma área em baixa acaba 'puxando' a energia das outras. Olhar para suas menores notas pode ser o primeiro passo para desbloquear o seu bem-estar geral.</Text>);
    }

    return parts;
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row justify-between items-center px-[20px] py-[15px] bg-[#1B4332]">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-white/70 font-sans font-semibold text-[15px]">&larr; Voltar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="bg-[#1B4332] px-[20px] pt-[20px] pb-[60px] items-center">
          <Text className="font-title text-white text-[32px] text-center mb-[10px]">Sua Roda da Vida</Text>
          <Text className="font-sans text-white/80 text-[16px] text-center max-w-[300px]">Avalie de 1 a 10 como estão as áreas da sua vida e visualize seu equilíbrio atual.</Text>
        </View>

        <View className="px-[20px] mt-[-40px]">
          {/* Box Sliders */}
          <View className="bg-white rounded-[24px] p-[25px] shadow-[0_10px_40px_rgba(0,0,0,0.06)] border border-[#f0f0f0] mb-[20px]">
            <Text className="font-title text-[#1B4332] text-[22px] mb-[20px]">Avalie seu momento</Text>
            
            {LABELS.map((label, idx) => (
              <View key={idx} className="mb-[20px]">
                <View className="flex-row justify-between items-center mb-[8px]">
                  <Text className="font-sans font-semibold text-[#333]">{label}</Text>
                  <View className="bg-[#FFEE8C] px-[10px] py-[2px] rounded-[12px]">
                    <Text className="font-sans font-bold text-[#1B4332] text-[14px]">{values[idx]}</Text>
                  </View>
                </View>
                <Slider
                  style={{ width: '100%', height: 40 }}
                  minimumValue={1}
                  maximumValue={10}
                  step={1}
                  value={values[idx]}
                  onValueChange={(val) => updateValue(idx, val)}
                  minimumTrackTintColor="#1B4332"
                  maximumTrackTintColor="#e9ecef"
                  thumbTintColor="#FFEE8C"
                />
              </View>
            ))}
          </View>

          {/* Box Chart */}
          <View className="bg-white rounded-[24px] p-[20px] shadow-[0_10px_40px_rgba(0,0,0,0.06)] border border-[#f0f0f0] items-center mb-[20px]">
            <Svg width={size} height={size}>
              {/* Grid Lines (10 levels) */}
              {[2,4,6,8,10].map(level => {
                const r = (level / 10) * maxRadius;
                const pts = Array.from({length: 6}).map((_, i) => {
                  const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                  return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
                }).join(' ');
                return <Polygon key={level} points={pts} stroke="rgba(0,0,0,0.05)" strokeWidth="1" fill="none" />;
              })}
              
              {/* Axes */}
              {Array.from({length: 6}).map((_, i) => {
                const {x, y} = getCoordinatesForValue(10, i);
                return <Line key={i} x1={center} y1={center} x2={x} y2={y} stroke="rgba(0,0,0,0.05)" strokeWidth="1" />;
              })}

              {/* Data Polygon */}
              <Polygon 
                points={polygonPoints} 
                fill="rgba(27, 67, 50, 0.2)" 
                stroke="#1B4332" 
                strokeWidth="2" 
              />
              
              {/* Data Points */}
              {values.map((val, i) => {
                const {x, y} = getCoordinatesForValue(val, i);
                return <Circle key={i} cx={x} cy={y} r="5" fill="#FFEE8C" stroke="#1B4332" strokeWidth="2" />;
              })}

              {/* Labels */}
              {LABELS.map((label, i) => {
                // Offset label slightly outside max radius
                const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                const r = maxRadius + 20; 
                let x = center + r * Math.cos(angle);
                const y = center + r * Math.sin(angle);
                
                // Align text based on x position
                let textAnchor = "middle";
                if (Math.abs(Math.cos(angle)) > 0.1) {
                    textAnchor = Math.cos(angle) > 0 ? "start" : "end";
                    x = center + (maxRadius + 10) * Math.cos(angle);
                }

                return (
                  <SvgText 
                    key={i} 
                    x={x} 
                    y={y + 4} 
                    fontSize="10" 
                    fill="#555" 
                    textAnchor={textAnchor}
                    fontFamily="Inter"
                  >
                    {label.split(' ')[0]}
                  </SvgText>
                );
              })}
            </Svg>
          </View>

          {/* Summary Box */}
          <View className="bg-white rounded-[16px] p-[20px] mb-[20px] border-l-[4px] border-l-[#FFEE8C] shadow-[0_4px_15px_rgba(0,0,0,0.03)]">
            <Text className="font-title text-[#1B4332] text-[20px] mb-[10px]">Análise do seu momento</Text>
            <Text className="font-sans text-[#555] text-[15px] leading-[22px]">
              {getSummary()}
            </Text>
          </View>

          {/* CTA Banner */}
          <View className="bg-[#fffbeb] border border-[#fde68a] p-[25px] rounded-[16px] items-center">
            <Text className="font-title text-[#b45309] text-[22px] mb-[10px]">Precisa de mais equilíbrio?</Text>
            <Text className="font-sans text-[#92400e] text-[15px] text-center mb-[20px]">A terapia é o melhor caminho para entender e equilibrar as áreas que estão puxando sua nota para baixo.</Text>
            <TouchableOpacity 
              onPress={() => router.push('/questionario')}
              className="w-full bg-[#1B4332] py-[16px] rounded-[50px] items-center shadow-[0_4px_10px_rgba(27,67,50,0.3)]"
            >
              <Text className="font-sans font-bold text-white text-[17px]">Encontrar meu Psicólogo</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
