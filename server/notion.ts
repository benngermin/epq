import { Client } from "@notionhq/client";

// Initialize Notion client
export const notion = new Client({
    auth: process.env.NOTION_INTEGRATION_SECRET!,
});

// Extract the database ID from the Notion database URL
function extractDatabaseIdFromUrl(databaseUrl: string): string {
    const match = databaseUrl.match(/([a-f0-9]{32})(?:[?#]|$)/i);
    if (match && match[1]) {
        return match[1];
    }

    throw Error("Failed to extract database ID from URL");
}

// Since user has an existing database, we use the URL directly as database ID
export const FEEDBACK_DATABASE_ID = extractDatabaseIdFromUrl(process.env.NOTION_PAGE_URL!);


// Create a feedback entry in existing Notion database
export async function createFeedbackInNotion(feedbackData: {
    userName: string;
    userEmail: string;
    feedbackType: 'positive' | 'negative';
    feedbackMessage: string | null;
    assistantMessage: string | null;
    questionText?: string;
    courseName?: string;
    createdAt: Date;
}) {
    try {
        // First, let's get the database schema to understand what properties exist
        let databaseSchema: any;
        try {
            databaseSchema = await notion.databases.retrieve({
                database_id: FEEDBACK_DATABASE_ID
            });
        } catch (error) {
            console.error("Error retrieving database schema:", error);
            // Continue anyway - we'll try to add with common field names
        }

        // Build properties dynamically based on what fields might exist
        const properties: any = {};
        
        // Check for common field variations and add them if they likely exist
        const schemaProps = databaseSchema?.properties || {};
        const propNames = Object.keys(schemaProps);
        
        // Helper to find property by various name patterns
        const findProperty = (patterns: string[]) => {
            for (const pattern of patterns) {
                const found = propNames.find(name => 
                    name.toLowerCase().replace(/[^a-z]/g, '') === pattern.toLowerCase().replace(/[^a-z]/g, '')
                );
                if (found) return found;
            }
            return null;
        };
        
        // Title/Name field (required for Notion databases)
        const titleField = findProperty(['Title', 'Name', 'FeedbackTitle', 'Feedback']);
        if (titleField) {
            properties[titleField] = {
                title: [{
                    text: {
                        content: `${feedbackData.feedbackType === 'positive' ? '👍' : '👎'} Feedback from ${feedbackData.userName}`
                    }
                }]
            };
        } else {
            // If no title field found, try with 'Name' as default
            properties['Name'] = {
                title: [{
                    text: {
                        content: `${feedbackData.feedbackType === 'positive' ? '👍' : '👎'} Feedback from ${feedbackData.userName}`
                    }
                }]
            };
        }
        
        // User Name
        const userNameField = findProperty(['UserName', 'User', 'Name', 'User Name']);
        if (userNameField && schemaProps[userNameField]?.type === 'rich_text') {
            properties[userNameField] = {
                rich_text: [{
                    text: { content: feedbackData.userName }
                }]
            };
        }
        
        // User Email
        const emailField = findProperty(['UserEmail', 'Email', 'User Email']);
        if (emailField) {
            if (schemaProps[emailField]?.type === 'email') {
                properties[emailField] = { email: feedbackData.userEmail };
            } else if (schemaProps[emailField]?.type === 'rich_text') {
                properties[emailField] = {
                    rich_text: [{
                        text: { content: feedbackData.userEmail }
                    }]
                };
            }
        }
        
        // Feedback Type
        const typeField = findProperty(['FeedbackType', 'Type', 'Feedback Type']);
        if (typeField && schemaProps[typeField]?.type === 'select') {
            properties[typeField] = {
                select: { name: feedbackData.feedbackType === 'positive' ? 'Positive' : 'Negative' }
            };
        }
        
        // Feedback Message
        const messageField = findProperty(['FeedbackMessage', 'Message', 'Feedback', 'Feedback Message', 'Comment']);
        if (messageField && feedbackData.feedbackMessage && schemaProps[messageField]?.type === 'rich_text') {
            properties[messageField] = {
                rich_text: [{
                    text: { content: feedbackData.feedbackMessage.substring(0, 2000) }
                }]
            };
        }
        
        // Assistant Message
        const assistantField = findProperty(['AssistantMessage', 'Assistant', 'AI Message', 'Response']);
        if (assistantField && feedbackData.assistantMessage && schemaProps[assistantField]?.type === 'rich_text') {
            properties[assistantField] = {
                rich_text: [{
                    text: { content: feedbackData.assistantMessage.substring(0, 2000) }
                }]
            };
        }
        
        // Question Text
        const questionField = findProperty(['QuestionText', 'Question', 'Question Text']);
        if (questionField && feedbackData.questionText && schemaProps[questionField]?.type === 'rich_text') {
            properties[questionField] = {
                rich_text: [{
                    text: { content: feedbackData.questionText.substring(0, 2000) }
                }]
            };
        }
        
        // Course Name
        const courseField = findProperty(['CourseName', 'Course', 'Course Name']);
        if (courseField && feedbackData.courseName && schemaProps[courseField]?.type === 'rich_text') {
            properties[courseField] = {
                rich_text: [{
                    text: { content: feedbackData.courseName }
                }]
            };
        }
        
        // Created Date
        const dateField = findProperty(['CreatedAt', 'Created', 'Date', 'Created At', 'Timestamp']);
        if (dateField && schemaProps[dateField]?.type === 'date') {
            properties[dateField] = {
                date: { start: feedbackData.createdAt.toISOString() }
            };
        }
        
        // Status
        const statusField = findProperty(['Status']);
        if (statusField && schemaProps[statusField]?.type === 'select') {
            properties[statusField] = {
                select: { name: 'New' }
            };
        }

        // Create the feedback entry in the existing database
        const response = await notion.pages.create({
            parent: {
                database_id: FEEDBACK_DATABASE_ID
            },
            properties
        });

        console.log("✓ Feedback synced to Notion successfully");
        return response;
    } catch (error) {
        console.error("Error creating feedback in Notion:", error);
        // Don't throw - we don't want to break the main feedback flow if Notion sync fails
        return null;
    }
}