// Slack integration for sending feedback notifications
export async function sendFeedbackToSlack(feedbackData: {
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
    questionNumber?: number;
    questionSetNumber?: number;
    createdAt: Date;
    conversation?: Array<{id: string, content: string, role: "user" | "assistant"}> | null;
    baseUrl: string;
}) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    
    if (!webhookUrl) {
        if (process.env.NODE_ENV === 'development') {
            console.log('Slack webhook URL not configured - skipping Slack notification');
        }
        return null;
    }
    
    try {
        // Format timestamp
        const timestamp = Math.floor(feedbackData.createdAt.getTime() / 1000);
        
        // Determine color based on feedback type
        const color = feedbackData.feedbackType === 'positive' ? '#36a64f' : '#ff4444';
        const emoji = feedbackData.feedbackType === 'positive' ? '👍' : '👎';
        
        // Build fields array for structured data
        const fields = [];
        
        // Add user information
        fields.push({
            title: 'User',
            value: `${feedbackData.userName} (${feedbackData.userEmail})`,
            short: true
        });
        
        // Add feedback type
        fields.push({
            title: 'Type',
            value: `${emoji} ${feedbackData.feedbackType === 'positive' ? 'Positive' : 'Negative'}`,
            short: true
        });
        
        // Add course information if available
        if (feedbackData.courseNumber || feedbackData.courseName) {
            const courseInfo = feedbackData.courseNumber || feedbackData.courseName;
            fields.push({
                title: 'Course',
                value: courseInfo,
                short: true
            });
        }
        
        // Add question set information if available
        if (feedbackData.questionSetTitle && feedbackData.questionSetNumber) {
            fields.push({
                title: 'Question Set',
                value: `${feedbackData.questionSetTitle} (#${feedbackData.questionSetNumber})`,
                short: true
            });
        } else if (feedbackData.questionSetTitle) {
            fields.push({
                title: 'Question Set',
                value: feedbackData.questionSetTitle,
                short: true
            });
        }
        
        // Add LOID if available
        if (feedbackData.loid) {
            fields.push({
                title: 'LOID',
                value: feedbackData.loid,
                short: true
            });
        }
        
        // Add question number if available
        if (feedbackData.questionNumber) {
            fields.push({
                title: 'Question #',
                value: feedbackData.questionNumber.toString(),
                short: true
            });
        }
        
        // Build the main message text
        let mainText = `New ${feedbackData.feedbackType} feedback received`;
        if (feedbackData.feedbackMessage) {
            // Truncate feedback message if too long for Slack
            const truncatedMessage = feedbackData.feedbackMessage.length > 300 
                ? feedbackData.feedbackMessage.substring(0, 297) + '...'
                : feedbackData.feedbackMessage;
            mainText = `*Feedback Message:*\n${truncatedMessage}`;
        }
        
        // Build the Slack message payload
        const slackPayload: any = {
            text: `${emoji} New feedback from ${feedbackData.userName}`,
            attachments: [
                {
                    color: color,
                    title: 'Feedback Details',
                    text: mainText,
                    fields: fields,
                    footer: 'EPQ Feedback System',
                    ts: timestamp
                }
            ]
        };
        
        // Add question text as a separate attachment if available
        if (feedbackData.questionText) {
            const truncatedQuestion = feedbackData.questionText.length > 500 
                ? feedbackData.questionText.substring(0, 497) + '...'
                : feedbackData.questionText;
            
            slackPayload.attachments.push({
                color: '#e0e0e0',
                title: '❓ Question',
                text: truncatedQuestion,
                mrkdwn_in: ['text']
            });
        }
        
        // Add assistant message as a separate attachment if available and it's about the AI's response
        if (feedbackData.assistantMessage && feedbackData.feedbackType === 'negative') {
            const truncatedAssistant = feedbackData.assistantMessage.length > 500 
                ? feedbackData.assistantMessage.substring(0, 497) + '...'
                : feedbackData.assistantMessage;
            
            slackPayload.attachments.push({
                color: '#ffa500',
                title: '🤖 Assistant Response',
                text: truncatedAssistant,
                mrkdwn_in: ['text']
            });
        }
        
        // Send to Slack
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(slackPayload)
        });
        
        if (!response.ok) {
            throw new Error(`Slack API returned ${response.status}: ${response.statusText}`);
        }
        
        if (process.env.NODE_ENV === 'development') {
            console.log('✓ Feedback sent to Slack successfully');
        }
        
        return { success: true };
        
    } catch (error) {
        console.error('Error sending feedback to Slack:', error);
        // Don't throw - we don't want to break the main feedback flow if Slack notification fails
        return null;
    }
}