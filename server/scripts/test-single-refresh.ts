import { db } from '../db';
import { storage } from '../storage';
import { questions, questionVersions } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';

// Environment variables should be set externally, not hardcoded
// Required: BUBBLE_API_KEY and DATABASE_URL
if (!process.env.BUBBLE_API_KEY || !process.env.DATABASE_URL) {
  console.error('❌ Missing required environment variables: BUBBLE_API_KEY and DATABASE_URL');
  process.exit(1);
}

async function testSingleRefresh() {
  try {
    console.log('🧪 Testing single question set refresh...');
    
    // Use question set ID 5 which had 99 questions from our earlier check
    const questionSetId = 5;
    
    console.log(`📥 Fetching question set ${questionSetId} from Bubble API...`);
    
    // Make API call to Bubble to get the question set
    const bubbleResponse = await fetch(`https://ti-content-repository.bubbleapps.io/version-test/api/1.1/obj/question_set`, {
      headers: {
        'Authorization': `Bearer ${process.env.BUBBLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!bubbleResponse.ok) {
      throw new Error(`Bubble API error: ${bubbleResponse.status} ${bubbleResponse.statusText}`);
    }
    
    const bubbleData = await bubbleResponse.json();
    console.log(`✅ Retrieved ${bubbleData.response.results?.length || 0} question sets from Bubble`);
    
    // Find our specific question set by external ID
    const questionSet = await storage.getQuestionSet(questionSetId);
    if (!questionSet) {
      throw new Error(`Question set ${questionSetId} not found in database`);
    }
    
    console.log(`🎯 Found question set: "${questionSet.title}" (External ID: ${questionSet.externalId})`);
    
    // Debug: Show first few Bubble question sets to understand the structure
    console.log('\n🔍 First 3 Bubble question sets:');
    bubbleData.response.results?.slice(0, 3).forEach((qs: any, index: number) => {
      console.log(`   ${index + 1}. ID: ${qs._id}, Unique ID: ${qs.unique_id}, Title: ${qs.title}`);
    });
    
    // Find the matching question set from Bubble - try both unique_id and _id
    let bubbleQuestionSet = bubbleData.response.results?.find((qs: any) => 
      qs.unique_id === questionSet.externalId || qs._id === questionSet.externalId
    );
    
    if (!bubbleQuestionSet) {
      throw new Error(`Question set with external ID ${questionSet.externalId} not found in Bubble response`);
    }
    
    console.log(`📊 Bubble question set has ${bubbleQuestionSet.question_set?.length || 0} questions`);
    
    // Convert Bubble format to our import format
    const questionsToImport = bubbleQuestionSet.question_set?.map((q: any, index: number) => ({
      question_number: index + 1,
      loid: q.loid || `generated_${Date.now()}_${index}`,
      versions: [{
        version_number: 1,
        topic_focus: q.topic_focus || 'General',
        question_text: q.question_text || '',
        question_type: q.type || 'multiple_choice',
        answer_choices: q.answer_choices || [],
        correct_answer: q.correct_answer || '',
        acceptable_answers: q.acceptable_answers || [],
        case_sensitive: q.case_sensitive || false,
        allow_multiple: q.allow_multiple || false,
        matching_pairs: q.matching_pairs || null,
        correct_order: q.correct_order || null,
        blanks: q.blanks || null,
        drop_zones: q.drop_zones || null
      }]
    })) || [];
    
    console.log(`🔄 Prepared ${questionsToImport.length} questions for import`);
    
    // Test our new versioning logic
    await storage.updateQuestionsForRefresh(questionSetId, questionsToImport);
    
    console.log('✅ Refresh completed successfully!');
    
    // Verify the results using Drizzle ORM
    const questionsAfter = await db.select({
      count: sql<number>`count(*)`
    })
    .from(questions)
    .where(eq(questions.questionSetId, questionSetId));
    
    const versionsAfter = await db.select({
      totalCount: sql<number>`count(*)`,
      activeCount: sql<number>`count(case when ${questionVersions.isActive} then 1 end)`
    })
    .from(questionVersions)
    .innerJoin(questions, eq(questionVersions.questionId, questions.id))
    .where(eq(questions.questionSetId, questionSetId));
    
    console.log('\n📊 Results:');
    console.log(`   Questions created: ${questionsAfter[0]?.count || 0}`);
    console.log(`   Total versions: ${versionsAfter[0]?.totalCount || 0}`);
    console.log(`   Active versions: ${versionsAfter[0]?.activeCount || 0}`);
    
    // Show sample data
    const sampleVersions = await db.select({
      originalQuestionNumber: questions.originalQuestionNumber,
      versionNumber: questionVersions.versionNumber,
      isActive: questionVersions.isActive,
      questionPreview: sql<string>`LEFT(${questionVersions.questionText}, 50)`
    })
    .from(questionVersions)
    .innerJoin(questions, eq(questionVersions.questionId, questions.id))
    .where(eq(questions.questionSetId, questionSetId))
    .orderBy(questions.originalQuestionNumber, questionVersions.versionNumber)
    .limit(5);
    
    console.log('\n🔍 Sample questions:');
    sampleVersions.forEach((row: any) => {
      const activeMarker = row.isActive ? '✅' : '❌';
      console.log(`   Q${row.originalQuestionNumber} v${row.versionNumber} ${activeMarker}: ${row.questionPreview}...`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

testSingleRefresh()
  .then(() => {
    console.log('🎉 Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });