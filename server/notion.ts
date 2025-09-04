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
    feedbackId: number;
    userName: string;
    userEmail: string;
    feedbackType: 'positive' | 'negative';
    feedbackMessage: string | null;
    assistantMessage: string | null;
    questionText?: string;
    courseName?: string;
    courseNumber?: string;
    questionSetTitle?: string;
    loid?: string;
    createdAt: Date;
    conversation?: Array<{id: string, content: string, role: "user" | "assistant"}> | null;
    baseUrl: string;
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
        
        // Customer Email - specific field requested by user
        const customerEmailField = findProperty(['CustomerEmail', 'Customer Email']);
        if (customerEmailField) {
            if (schemaProps[customerEmailField]?.type === 'email') {
                properties[customerEmailField] = { email: feedbackData.userEmail };
            } else if (schemaProps[customerEmailField]?.type === 'rich_text') {
                properties[customerEmailField] = {
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
        
        // Sentiment field (single select with Positive/Negative)
        const sentimentField = findProperty(['Sentiment']);
        if (sentimentField && schemaProps[sentimentField]?.type === 'select') {
            properties[sentimentField] = {
                select: {
                    name: feedbackData.feedbackType === 'positive' ? 'Positive' : 'Negative'
                }
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
        
        // Course Number - specific field requested by user
        const courseNumberField = findProperty(['CourseNumber', 'Course Number']);
        if (courseNumberField && feedbackData.courseNumber) {
            if (schemaProps[courseNumberField]?.type === 'rich_text') {
                properties[courseNumberField] = {
                    rich_text: [{
                        text: { content: feedbackData.courseNumber }
                    }]
                };
            } else if (schemaProps[courseNumberField]?.type === 'title') {
                properties[courseNumberField] = {
                    title: [{
                        text: { content: feedbackData.courseNumber }
                    }]
                };
            }
        }
        
        // LOID - specific field requested by user
        const loidField = findProperty(['LOID', 'Loid']);
        if (loidField && feedbackData.loid) {
            if (schemaProps[loidField]?.type === 'rich_text') {
                properties[loidField] = {
                    rich_text: [{
                        text: { content: feedbackData.loid }
                    }]
                };
            } else if (schemaProps[loidField]?.type === 'title') {
                properties[loidField] = {
                    title: [{
                        text: { content: feedbackData.loid }
                    }]
                };
            }
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
        
        // Channel field - set to 'EPQ'
        const channelField = findProperty(['Channel']);
        if (channelField && schemaProps[channelField]?.type === 'select') {
            properties[channelField] = {
                select: { name: 'EPQ' }
            };
        }
        
        // URL field - direct link to feedback
        const urlField = findProperty(['URL', 'Link']);
        if (urlField) {
            const feedbackUrl = `${feedbackData.baseUrl}/admin/feedback/${feedbackData.feedbackId}`;
            if (schemaProps[urlField]?.type === 'url') {
                properties[urlField] = { url: feedbackUrl };
            } else if (schemaProps[urlField]?.type === 'rich_text') {
                properties[urlField] = {
                    rich_text: [{
                        text: { content: feedbackUrl }
                    }]
                };
            }
        }

        // Prepare the page content with feedback message and conversation
        const children: any[] = [];
        
        // Add context information section
        children.push({
            object: 'block',
            type: 'heading_2',
            heading_2: {
                rich_text: [{
                    type: 'text',
                    text: { content: '📚 Context Information' }
                }]
            }
        });
        
        // Add course and question set info
        if (feedbackData.courseNumber || feedbackData.courseName || feedbackData.questionSetTitle) {
            const contextInfo: string[] = [];
            // Use course number if available, otherwise fall back to course name
            if (feedbackData.courseNumber) {
                contextInfo.push(`📖 Course: ${feedbackData.courseNumber}`);
            } else if (feedbackData.courseName) {
                contextInfo.push(`📖 Course: ${feedbackData.courseName}`);
            }
            if (feedbackData.questionSetTitle) {
                contextInfo.push(`📝 Question Set: ${feedbackData.questionSetTitle}`);
            }
            if (feedbackData.loid) {
                contextInfo.push(`🎯 LOID: ${feedbackData.loid}`);
            }
            
            for (const info of contextInfo) {
                children.push({
                    object: 'block',
                    type: 'paragraph',
                    paragraph: {
                        rich_text: [{
                            type: 'text',
                            text: { content: info }
                        }]
                    }
                });
            }
        }
        
        // Add question text if available
        if (feedbackData.questionText) {
            children.push(
                {
                    object: 'block',
                    type: 'heading_3',
                    heading_3: {
                        rich_text: [{
                            type: 'text',
                            text: { content: '❓ Question' }
                        }]
                    }
                },
                {
                    object: 'block',
                    type: 'paragraph',
                    paragraph: {
                        rich_text: [{
                            type: 'text',
                            text: { content: feedbackData.questionText }
                        }]
                    }
                }
            );
        }
        
        // Add divider before feedback message
        children.push({
            object: 'block',
            type: 'divider',
            divider: {}
        });
        
        // Add feedback message section
        if (feedbackData.feedbackMessage) {
            children.push(
                {
                    object: 'block',
                    type: 'heading_2',
                    heading_2: {
                        rich_text: [{
                            type: 'text',
                            text: { content: '📝 User Feedback' }
                        }]
                    }
                },
                {
                    object: 'block',
                    type: 'paragraph',
                    paragraph: {
                        rich_text: [{
                            type: 'text',
                            text: { content: feedbackData.feedbackMessage }
                        }]
                    }
                },
                {
                    object: 'block',
                    type: 'divider',
                    divider: {}
                }
            );
        }
        
        // Add conversation section
        if (feedbackData.conversation && feedbackData.conversation.length > 0) {
            children.push({
                object: 'block',
                type: 'heading_2',
                heading_2: {
                    rich_text: [{
                        type: 'text',
                        text: { content: '💬 Full Conversation' }
                    }]
                }
            });
            
            // Add each message in the conversation
            for (const message of feedbackData.conversation) {
                const isUser = message.role === 'user';
                const emoji = isUser ? '👤' : '🤖';
                const label = isUser ? 'User' : 'Assistant';
                
                // Add role header
                children.push({
                    object: 'block',
                    type: 'heading_3',
                    heading_3: {
                        rich_text: [{
                            type: 'text',
                            text: { content: `${emoji} ${label}` }
                        }]
                    }
                });
                
                // Split long messages into chunks (Notion has a 2000 character limit per block)
                const chunks = message.content.match(/.{1,2000}/gs) || [message.content];
                for (const chunk of chunks) {
                    children.push({
                        object: 'block',
                        type: 'paragraph',
                        paragraph: {
                            rich_text: [{
                                type: 'text',
                                text: { content: chunk }
                            }]
                        }
                    });
                }
                
                // Add spacing between messages
                children.push({
                    object: 'block',
                    type: 'paragraph',
                    paragraph: {
                        rich_text: []
                    }
                });
            }
        }
        
        // Create the feedback entry in the existing database with content
        const response = await notion.pages.create({
            parent: {
                database_id: FEEDBACK_DATABASE_ID
            },
            properties,
            children: children.length > 0 ? children : undefined
        });

        console.log("✓ Feedback synced to Notion successfully");
        return response;
    } catch (error) {
        console.error("Error creating feedback in Notion:", error);
        // Don't throw - we don't want to break the main feedback flow if Notion sync fails
        return null;
    }
}