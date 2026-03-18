import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
  TooltipComponent,
  GridComponent,
  VisualMapComponent,
  MarkAreaComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  TooltipComponent,
  GridComponent,
  VisualMapComponent,
  MarkAreaComponent,
  LineChart,
  CanvasRenderer,
]);

interface DesempenhoChartProps {
  dados?: { data: string; percentual: number }[];
  altura?: number;
}

const dadosPadrao = [
  { data: '01/Nov', percentual: 75 },
  { data: '08/Nov', percentual: 60 },
  { data: '15/Nov', percentual: 42 },
  { data: '22/Nov', percentual: 65 },
  { data: '29/Nov', percentual: 80 },
  { data: '06/Dez', percentual: 55 },
  { data: '13/Dez', percentual: 38 },
  { data: '20/Dez', percentual: 72 },
  { data: '27/Dez', percentual: 85 },
  { data: '03/Jan', percentual: 78 },
  { data: '10/Jan', percentual: 82 },
  { data: '15/Jan', percentual: 88 },
];

export function DesempenhoChart({ dados = dadosPadrao, altura = 90 }: DesempenhoChartProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const divRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!divRef.current || !wrapperRef.current) return;

    chartRef.current = echarts.init(divRef.current);

    const labels = dados.map(d => d.data);
    const valores = dados.map(d => d.percentual);
    const QUEDA_MIN = 5;

    // Segmentos coloridos: verde se SUBINDO, vermelho se CAINDO
    const pieces: object[] = [];
    for (let i = 0; i < dados.length - 1; i++) {
      const cor = dados[i + 1].percentual >= dados[i].percentual ? '#16a34a' : '#ef4444';
      if (i === 0) pieces.push({ lte: i + 1, color: cor });
      else if (i === dados.length - 2) pieces.push({ gt: i, color: cor });
      else pieces.push({ gt: i, lte: i + 1, color: cor });
    }

    // markArea: só períodos de QUEDA significativa
    const markAreaData: [object, object][] = [];
    let declineStart: number | null = null;

    for (let i = 1; i < dados.length; i++) {
      const caindo = dados[i].percentual < dados[i - 1].percentual;
      if (caindo && declineStart === null) {
        declineStart = i - 1;
      } else if (!caindo && declineStart !== null) {
        const queda = dados[declineStart].percentual - dados[i - 1].percentual;
        if (queda >= QUEDA_MIN) {
          markAreaData.push([
            { xAxis: dados[declineStart].data },
            { xAxis: dados[i - 1].data },
          ]);
        }
        declineStart = null;
      }
    }
    if (declineStart !== null) {
      const queda = dados[declineStart].percentual - dados[dados.length - 1].percentual;
      if (queda >= QUEDA_MIN) {
        markAreaData.push([
          { xAxis: dados[declineStart].data },
          { xAxis: dados[dados.length - 1].data },
        ]);
      }
    }

    // Renderiza já com as cores corretas (sem animação do ECharts)
    chartRef.current.setOption({
      animation: false,
      grid: { top: 18, bottom: 22, left: 4, right: 32, containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1e293b',
        borderColor: '#334155',
        textStyle: { color: '#f1f5f9', fontSize: 11 },
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          return `${p.name}<br/><b>${p.value}%</b>`;
        },
      },
      visualMap: { show: false, dimension: 0, pieces },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: labels,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 9, color: '#94a3b8', margin: 4 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        interval: 20,
        show: true,
        axisLabel: {
          fontSize: 8,
          color: '#94a3b8',
          formatter: '{value}%',
        },
        splitLine: {
          show: true,
          lineStyle: { color: '#e2e8f0', type: 'dashed', width: 1 },
        },
      },
      series: [{
        type: 'line',
        smooth: true,
        data: valores,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2.5 },
        itemStyle: { borderWidth: 1.5, borderColor: '#fff' },
        areaStyle: { color: 'transparent' },
        label: {
          show: true,
          position: 'top',
          fontSize: 9,
          fontWeight: 700,
          formatter: (p: any) =>
            p.dataIndex === dados.length - 1 ? `${p.value}%` : '',
        },
        markArea: markAreaData.length > 0 ? {
          itemStyle: { color: 'rgba(239, 68, 68, 0.1)' },
          data: markAreaData,
        } : undefined,
      }],
    });

    // Animação CSS: revela o gráfico da esquerda para a direita
    const wrapper = wrapperRef.current;
    const onEnd = () => {
      wrapper.style.clipPath = '';
      wrapper.style.transition = '';
    };
    wrapper.addEventListener('transitionend', onEnd, { once: true });
    wrapper.style.clipPath = 'inset(0 100% 0 0)';
    wrapper.getBoundingClientRect(); // força reflow
    wrapper.style.transition = 'clip-path 1.2s linear';
    wrapper.style.clipPath = 'inset(0 0% 0 0)';

    const ro = new ResizeObserver(() => chartRef.current?.resize());
    ro.observe(divRef.current);

    return () => {
      wrapper.removeEventListener('transitionend', onEnd);
      wrapper.style.clipPath = '';
      wrapper.style.transition = '';
      ro.disconnect();
      chartRef.current?.dispose();
    };
  }, [dados]);

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: `${altura}px` }}>
      <div ref={divRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
