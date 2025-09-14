import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xmtleqquivcukwgdexhc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdGxlcXF1aXZjdWt3Z2RleGhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzIyOTk5NywiZXhwIjoyMDY4ODA1OTk3fQ.a-n50z1KmRa7JRoREBJKf3kSoXfU9U-t8G_PXnBFqDI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedDatabase() {
  try {
    console.log('Starting database seeding...');
    
    // Insert units
    const unitsData = [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Unit 2: Cell biology'
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440100',
        title: 'Unit 3: Organ systems'
      }
    ];
    
    const { data: unitsResult, error: unitsError } = await supabase
      .from('units')
      .upsert(unitsData, { onConflict: 'id' });
    
    if (unitsError) {
      console.error('Error inserting units:', unitsError);
      return;
    }
    console.log('Units inserted successfully');
    
    // Insert topics
    const topicsData = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        unit_id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Cell membrane structure and function'
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        unit_id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Transport across a cell membrane'
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        unit_id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Cell-cell interactions'
      }
    ];
    
    const { data: topicsResult, error: topicsError } = await supabase
      .from('topics')
      .upsert(topicsData, { onConflict: 'id' });
    
    if (topicsError) {
      console.error('Error inserting topics:', topicsError);
      return;
    }
    console.log('Topics inserted successfully');
    
    // Insert subtopics
    const subtopicsData = [
      {
        id: '550e8400-e29b-41d4-a716-446655440010',
        topic_id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Membrane structure',
        average_time: 15
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440011',
        topic_id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Membrane proteins',
        average_time: 12
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440012',
        topic_id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Membrane dynamics',
        average_time: 10
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440020',
        topic_id: '550e8400-e29b-41d4-a716-446655440002',
        title: 'Passive transport mechanisms',
        average_time: 18
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440021',
        topic_id: '550e8400-e29b-41d4-a716-446655440002',
        title: 'Active transport systems',
        average_time: 14
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440022',
        topic_id: '550e8400-e29b-41d4-a716-446655440002',
        title: 'Vesicular transport',
        average_time: 11
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440030',
        topic_id: '550e8400-e29b-41d4-a716-446655440003',
        title: 'Cell junctions and adhesion',
        average_time: 16
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440031',
        topic_id: '550e8400-e29b-41d4-a716-446655440003',
        title: 'Cell signaling pathways',
        average_time: 13
      }
    ];
    
    const { data: subtopicsResult, error: subtopicsError } = await supabase
      .from('subtopics')
      .upsert(subtopicsData, { onConflict: 'id' });
    
    if (subtopicsError) {
      console.error('Error inserting subtopics:', subtopicsError);
      return;
    }
    console.log('Subtopics inserted successfully');
    
    console.log('Database seeding completed successfully!');
    
  } catch (err) {
    console.error('Database seeding failed:', err);
  }
}

seedDatabase();