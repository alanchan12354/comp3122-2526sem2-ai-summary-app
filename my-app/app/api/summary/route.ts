export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import pdfParse from 'pdf-parse';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // strictly server-side
});

export async function POST(request: Request) {
  try {
    const { fileName } = await request.json();
    if (!fileName) {
      return NextResponse.json({ error: 'No file name provided' }, { status: 400 });
    }

    // Download the file from Supabase
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(fileName);

    if (downloadError || !fileData) {
      console.error('Download error:', downloadError);
      return NextResponse.json({ error: downloadError?.message || 'File not found' }, { status: 404 });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extractedText = '';

    if (fileName.toLowerCase().endsWith('.pdf')) {
      try {
        const pdftxt = await pdfParse(buffer);
        extractedText = pdftxt.text;
      } catch (e: unknown) {
        return NextResponse.json({ error: 'Failed to parse PDF' }, { status: 500 });
      }
    } else {
      // attempt as text
      extractedText = buffer.toString('utf-8');
    }

    if (!extractedText || extractedText.trim() === '') {
      return NextResponse.json({ error: 'No text found in the document' }, { status: 400 });
    }

    // Use OpenAI to summarize
    const chatCompletion = await openai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a helpful assistant that summarizes documents. Provide a concise summary of the following text, highlighting the main points.' },
        { role: 'user', content: extractedText.substring(0, 15000) } // limit characters to avoid token limits
      ],
      model: 'gpt-3.5-turbo',
      temperature: 0.5,
      max_tokens: 250,
    });

    const summary = chatCompletion.choices[0]?.message?.content || 'Could not generate summary.';

    return NextResponse.json({ summary }, { status: 200 });

  } catch (error: unknown) {
    console.error('Summary generation error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Something went wrong' }, { status: 500 });
  }
}
