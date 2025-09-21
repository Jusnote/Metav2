import React, { useState } from 'react';
import { Calendar, Clock, BookOpen } from 'lucide-react';
import { DayWithProgress } from '../components/DayWithProgress';

// Mock data para progresso dos dias
const mockDailyProgress = {
  1: 85,   // 85% completo
  3: 45,   // 45% completo
  7: 100,  // 100% completo
  12: 30,  // 30% completo
  15: 67,  // 67% completo
  18: 90,  // 90% completo
  21: 25,  // 25% completo (hoje)
  24: 0,   // 0% completo
  28: 55,  // 55% completo
};

// Mock data para testes
const mockTopics = [
  {
    id: '1',
    title: 'RemNote MCAT Overview',
    estimatedTime: '0 min',
    cardsCount: 1,
    status: null,
    completed: false
  },
  {
    id: '2', 
    title: 'Cell membrane overview',
    estimatedTime: '19 min',
    cardsCount: 6,
    status: 'Pré-teste',
    completed: false
  },
  {
    id: '3',
    title: 'Biological basis of behavior: The nervous system', 
    estimatedTime: '13 min',
    cardsCount: 15,
    status: null,
    completed: false
  },
  {
    id: '4',
    title: 'Vectors and scalars',
    estimatedTime: '3 min', 
    cardsCount: 4,
    status: null,
    completed: false
  },
  {
    id: '5',
    title: 'Acid/base equilibria',
    estimatedTime: '12 min',
    cardsCount: 14, 
    status: null,
    completed: false
  },
  {
    id: '6',
    title: 'Self-identity',
    estimatedTime: '8 min',
    cardsCount: 10,
    status: null,
    completed: false
  }
];

export default function CronogramaPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(21);
  
  const handleDayClick = (day: number) => {
    setSelectedDay(day);
    // Aqui você pode atualizar os tópicos baseado no dia selecionado
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Cronograma de Estudos</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4">
        {/* Single unified container */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="grid grid-cols-12">
            
            {/* Calendar Sidebar */}
            <div className="col-span-12 lg:col-span-3 border-r border-gray-200 p-6">
              {/* Date Info */}
              <div className="mb-6">
                <div className="text-2xl font-bold text-gray-900">Sep {selectedDay}</div>
                <div className="text-sm text-gray-500">Sunday</div>
              </div>
              
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                Novembro de 2024
              </h2>
              
              {/* Simple Calendar Grid */}
              <div className="space-y-2">
                {/* Calendar Header */}
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500 mb-2">
                  <div>Dom</div>
                  <div>Seg</div>
                  <div>Ter</div>
                  <div>Qua</div>
                  <div>Qui</div>
                  <div>Sex</div>
                  <div>Sáb</div>
                </div>
                
                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Week 1 */}
                  <DayWithProgress day={0} progress={0} isEmpty />
                  <DayWithProgress day={0} progress={0} isEmpty />
                  <DayWithProgress day={0} progress={0} isEmpty />
                  <DayWithProgress day={0} progress={0} isEmpty />
                  <DayWithProgress day={0} progress={0} isEmpty />
                  <DayWithProgress 
                    day={1} 
                    progress={mockDailyProgress[1] || 0}
                    isSelected={selectedDay === 1}
                    onClick={() => handleDayClick(1)}
                  />
                  <DayWithProgress 
                    day={2} 
                    progress={mockDailyProgress[2] || 0}
                    isSelected={selectedDay === 2}
                    onClick={() => handleDayClick(2)}
                  />
                  
                  {/* Week 2 */}
                  <DayWithProgress 
                    day={3} 
                    progress={mockDailyProgress[3] || 0}
                    isSelected={selectedDay === 3}
                    onClick={() => handleDayClick(3)}
                  />
                  <DayWithProgress 
                    day={4} 
                    progress={mockDailyProgress[4] || 0}
                    isSelected={selectedDay === 4}
                    onClick={() => handleDayClick(4)}
                  />
                  <DayWithProgress 
                    day={5} 
                    progress={mockDailyProgress[5] || 0}
                    isSelected={selectedDay === 5}
                    onClick={() => handleDayClick(5)}
                  />
                  <DayWithProgress 
                    day={6} 
                    progress={mockDailyProgress[6] || 0}
                    isSelected={selectedDay === 6}
                    onClick={() => handleDayClick(6)}
                  />
                  <DayWithProgress 
                    day={7} 
                    progress={mockDailyProgress[7] || 0}
                    isSelected={selectedDay === 7}
                    onClick={() => handleDayClick(7)}
                  />
                  <DayWithProgress 
                    day={8} 
                    progress={mockDailyProgress[8] || 0}
                    isSelected={selectedDay === 8}
                    onClick={() => handleDayClick(8)}
                  />
                  <DayWithProgress 
                    day={9} 
                    progress={mockDailyProgress[9] || 0}
                    isSelected={selectedDay === 9}
                    onClick={() => handleDayClick(9)}
                  />
                  
                  {/* Week 3 */}
                  <DayWithProgress 
                    day={10} 
                    progress={mockDailyProgress[10] || 0}
                    isSelected={selectedDay === 10}
                    onClick={() => handleDayClick(10)}
                  />
                  <DayWithProgress 
                    day={11} 
                    progress={mockDailyProgress[11] || 0}
                    isSelected={selectedDay === 11}
                    onClick={() => handleDayClick(11)}
                  />
                  <DayWithProgress 
                    day={12} 
                    progress={mockDailyProgress[12] || 0}
                    isSelected={selectedDay === 12}
                    onClick={() => handleDayClick(12)}
                  />
                  <DayWithProgress 
                    day={13} 
                    progress={mockDailyProgress[13] || 0}
                    isSelected={selectedDay === 13}
                    onClick={() => handleDayClick(13)}
                  />
                  <DayWithProgress 
                    day={14} 
                    progress={mockDailyProgress[14] || 0}
                    isSelected={selectedDay === 14}
                    onClick={() => handleDayClick(14)}
                  />
                  <DayWithProgress 
                    day={15} 
                    progress={mockDailyProgress[15] || 0}
                    isSelected={selectedDay === 15}
                    onClick={() => handleDayClick(15)}
                  />
                  <DayWithProgress 
                    day={16} 
                    progress={mockDailyProgress[16] || 0}
                    isSelected={selectedDay === 16}
                    onClick={() => handleDayClick(16)}
                  />
                  
                  {/* Week 4 */}
                  <DayWithProgress 
                    day={17} 
                    progress={mockDailyProgress[17] || 0}
                    isSelected={selectedDay === 17}
                    onClick={() => handleDayClick(17)}
                  />
                  <DayWithProgress 
                    day={18} 
                    progress={mockDailyProgress[18] || 0}
                    isSelected={selectedDay === 18}
                    onClick={() => handleDayClick(18)}
                  />
                  <DayWithProgress 
                    day={19} 
                    progress={mockDailyProgress[19] || 0}
                    isSelected={selectedDay === 19}
                    onClick={() => handleDayClick(19)}
                  />
                  <DayWithProgress 
                    day={20} 
                    progress={mockDailyProgress[20] || 0}
                    isSelected={selectedDay === 20}
                    onClick={() => handleDayClick(20)}
                  />
                  <DayWithProgress 
                    day={21} 
                    progress={mockDailyProgress[21] || 0}
                    isSelected={selectedDay === 21}
                    isToday={true}
                    onClick={() => handleDayClick(21)}
                  />
                  <DayWithProgress 
                    day={22} 
                    progress={mockDailyProgress[22] || 0}
                    isSelected={selectedDay === 22}
                    onClick={() => handleDayClick(22)}
                  />
                  <DayWithProgress 
                    day={23} 
                    progress={mockDailyProgress[23] || 0}
                    isSelected={selectedDay === 23}
                    onClick={() => handleDayClick(23)}
                  />
                  
                  {/* Week 5 */}
                  <DayWithProgress 
                    day={24} 
                    progress={mockDailyProgress[24] || 0}
                    isSelected={selectedDay === 24}
                    onClick={() => handleDayClick(24)}
                  />
                  <DayWithProgress 
                    day={25} 
                    progress={mockDailyProgress[25] || 0}
                    isSelected={selectedDay === 25}
                    onClick={() => handleDayClick(25)}
                  />
                  <DayWithProgress 
                    day={26} 
                    progress={mockDailyProgress[26] || 0}
                    isSelected={selectedDay === 26}
                    onClick={() => handleDayClick(26)}
                  />
                  <DayWithProgress 
                    day={27} 
                    progress={mockDailyProgress[27] || 0}
                    isSelected={selectedDay === 27}
                    onClick={() => handleDayClick(27)}
                  />
                  <DayWithProgress 
                    day={28} 
                    progress={mockDailyProgress[28] || 0}
                    isSelected={selectedDay === 28}
                    onClick={() => handleDayClick(28)}
                  />
                  <DayWithProgress 
                    day={29} 
                    progress={mockDailyProgress[29] || 0}
                    isSelected={selectedDay === 29}
                    onClick={() => handleDayClick(29)}
                  />
                  <DayWithProgress 
                    day={30} 
                    progress={mockDailyProgress[30] || 0}
                    isSelected={selectedDay === 30}
                    onClick={() => handleDayClick(30)}
                  />
                </div>
              </div>
              
            </div>

            {/* Topics List */}
            <div className="col-span-12 lg:col-span-9 p-6">
              
              {/* Topics Header */}
              <div className="mb-6 border-b pb-4">
                <h2 className="text-lg font-semibold text-gray-800">
                  Tópicos do Dia - {selectedDay} de Setembro
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {mockTopics.length} tópicos programados
                  {mockDailyProgress[selectedDay] && (
                    <span className="ml-2 text-blue-600 font-medium">
                      • {mockDailyProgress[selectedDay]}% completo
                    </span>
                  )}
                </p>
              </div>

              {/* Topics List */}
              <div className="space-y-1">
                {mockTopics.map((topic) => (
                  <div key={topic.id} className="flex items-center justify-between py-2 hover:bg-gray-50 transition-colors rounded-lg px-2">
                    {/* Topic Info */}
                    <div className="flex items-center gap-3 flex-1">
                      {/* Checkbox */}
                      <div className="w-5 h-5 border-2 border-gray-300 rounded-full flex items-center justify-center">
                        {topic.completed && (
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        )}
                      </div>
                      
                      {/* Topic Title */}
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{topic.title}</h3>
                        {topic.status && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 mt-1">
                            🧠 {topic.status}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Topic Stats */}
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      {/* Time */}
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{topic.estimatedTime}</span>
                      </div>
                      
                      {/* Cards Count */}
                      <div className="flex items-center gap-1">
                        <BookOpen className="h-4 w-4" />
                        <span>{topic.cardsCount}</span>
                      </div>
                      
                      {/* Expand Button */}
                      <button className="p-1 hover:bg-gray-100 rounded">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}