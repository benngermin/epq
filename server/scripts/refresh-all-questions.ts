import { db } from '../db';
import { storage } from '../storage';
import { questions, questionVersions, questionSets } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';
import { normalizeQuestionBlanks } from '../utils/blank-normalizer';

// Set environment variables for this script
process.env.BUBBLE_API_KEY = 'f3c17ebbeac064ee7d622172e95092d7';
process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_aBw2IZM9CHYj@ep-lively-rain-adt804hv.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function refreshAllQuestions() {
  try {
    console.log('🚀 Starting comprehensive refresh of all question sets...');
    const startTime = Date.now();
    
    // Get all question sets from our database
    const allQuestionSets = await db.select().from(questionSets);
    console.log(`📊 Found ${allQuestionSets.length} question sets to refresh`);
    
    // Fetch all question sets from Bubble API
    console.log('🌐 Fetching all question sets from Bubble API...');
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
    const bubbleQuestionSets = bubbleData.response.results || [];
    console.log(`✅ Retrieved ${bubbleQuestionSets.length} question sets from Bubble`);
    
    // Create a map of Bubble question sets by ID
    const bubbleMap = new Map();
    bubbleQuestionSets.forEach((bqs: any) => {
      bubbleMap.set(bqs._id, bqs);
    });
    
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    let totalQuestionsCreated = 0;
    const errors: Array<{questionSetId: number, title: string, error: string}> = [];
    
    console.log('\n🔄 Processing question sets...');
    
    for (const questionSet of allQuestionSets) {
      try {
        processedCount++;
        console.log(`\n[${processedCount}/${allQuestionSets.length}] Processing "${questionSet.title}" (ID: ${questionSet.id})`);
        
        // Find matching Bubble question set
        const bubbleQuestionSet = bubbleMap.get(questionSet.externalId);
        
        if (!bubbleQuestionSet) {
          console.log(`   ⚠️  No matching Bubble data found for external ID: ${questionSet.externalId}`);
          continue;
        }
        
        const bubbleQuestions = bubbleQuestionSet.question_set || [];
        console.log(`   📝 Found ${bubbleQuestions.length} questions in Bubble`);
        
        if (bubbleQuestions.length === 0) {
          console.log(`   ℹ️  Skipping - no questions in Bubble data`);
          continue;
        }
        
        // Convert Bubble format to our import format
        const questionsToImport = bubbleQuestions.map((q: any, index: number) => {
          // Normalize blank patterns in question text
          const { normalizedText: normalizedQuestionText } = normalizeQuestionBlanks(q.question_text || '');
          
          return {
            question_number: index + 1,
            loid: q.loid || `generated_${Date.now()}_${index}`,
            versions: [{
              version_number: 1,
              topic_focus: q.topic_focus || 'General',
              question_text: normalizedQuestionText,
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
          };
        });
        
        // Use our new versioning refresh logic
        await storage.updateQuestionsForRefresh(questionSet.id, questionsToImport);
        
        // Update question count
        await storage.updateQuestionSetCount(questionSet.id);
        
        totalQuestionsCreated += questionsToImport.length;
        successCount++;
        console.log(`   ✅ Successfully imported ${questionsToImport.length} questions`);
        
        // Small delay to avoid overwhelming the system
        if (processedCount % 10 === 0) {
          console.log(`   💤 Brief pause after processing ${processedCount} question sets...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({
          questionSetId: questionSet.id,
          title: questionSet.title,
          error: errorMessage
        });
        console.log(`   ❌ Error processing question set: ${errorMessage}`);
      }
    }
    
    // Final statistics
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log('\n🎉 Refresh completed!');
    console.log('=' .repeat(60));
    console.log(`📊 FINAL STATISTICS:`);
    console.log(`   • Duration: ${duration} seconds`);
    console.log(`   • Question sets processed: ${processedCount}`);
    console.log(`   • Successful imports: ${successCount}`);
    console.log(`   • Errors: ${errorCount}`);
    console.log(`   • Total questions created: ${totalQuestionsCreated}`);
    
    // Verify database state
    const finalQuestionCount = await db.select({
      count: sql<number>`count(*)`
    }).from(questions);
    
    const finalVersionCount = await db.select({
      totalCount: sql<number>`count(*)`,
      activeCount: sql<number>`count(case when ${questionVersions.isActive} then 1 end)`
    }).from(questionVersions);
    
    console.log('\n📈 DATABASE VERIFICATION:');
    console.log(`   • Total questions in database: ${finalQuestionCount[0].count}`);
    console.log(`   • Total question versions: ${finalVersionCount[0].totalCount}`);
    console.log(`   • Active versions: ${finalVersionCount[0].activeCount}`);
    console.log(`   • Version ratio: ${finalVersionCount[0].activeCount}/${finalVersionCount[0].totalCount} active`);
    
    if (errors.length > 0) {
      console.log('\n❌ ERRORS ENCOUNTERED:');
      errors.forEach(err => {
        console.log(`   • [${err.questionSetId}] ${err.title}: ${err.error}`);
      });
    }
    
    // Sample verification - show a few questions
    const sampleQuestions = await db.select({
      questionSetTitle: questionSets.title,
      originalQuestionNumber: questions.originalQuestionNumber,
      versionNumber: questionVersions.versionNumber,
      isActive: questionVersions.isActive,
      questionPreview: sql<string>`LEFT(${questionVersions.questionText}, 80)`
    })
    .from(questionVersions)
    .innerJoin(questions, eq(questionVersions.questionId, questions.id))
    .innerJoin(questionSets, eq(questions.questionSetId, questionSets.id))
    .where(eq(questionVersions.isActive, true))
    .limit(5);
    
    if (sampleQuestions.length > 0) {
      console.log('\n🔍 SAMPLE ACTIVE QUESTIONS:');
      sampleQuestions.forEach(q => {
        console.log(`   • ${q.questionSetTitle} Q${q.originalQuestionNumber} v${q.versionNumber}: ${q.questionPreview}...`);
      });
    }
    
    console.log('=' .repeat(60));
    
    return {
      success: errorCount === 0,
      processed: processedCount,
      successful: successCount,
      errors: errorCount,
      totalQuestions: totalQuestionsCreated,
      duration
    };
    
  } catch (error) {
    console.error('❌ Fatal error during refresh:', error);
    throw error;
  }
}

refreshAllQuestions()
  .then((results) => {
    console.log(`\n🏁 Refresh completed ${results.success ? 'successfully' : 'with errors'}!`);
    console.log(`📈 ${results.totalQuestions} questions now have exactly one active version each.`);
    
    if (results.success) {
      console.log('🎯 Ready for production! All question sets have been refreshed with the latest content.');
    } else {
      console.log(`⚠️  ${results.errors} errors occurred. Please review the error list above.`);
    }
    
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Refresh failed:', error);
    process.exit(1);
  });