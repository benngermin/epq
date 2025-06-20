-- Add question versions for the first few questions to get the app working
-- Question 1 from Set 1
INSERT INTO question_versions (question_id, version_number, topic_focus, question_text, answer_choices, correct_answer) 
SELECT id, 1, 'How insurance facilitates access to auto ownership by transferring risk', 
'Luke recently purchased his first car and was surprised by the cost of auto insurance. His agent explained the many benefits of carrying auto insurance. All of the following are benefits of auto insurance, EXCEPT:',
'["A. It enables Luke to drive legally in most states by meeting mandatory insurance requirements.", "B. It helps Luke return to his financial position before a loss if his vehicle is damaged in a covered event.", "C. It provides protection from potentially high legal expenses if Luke causes an accident.", "D. It allows Luke to profit if his car is involved in a covered loss."]',
'D'
FROM questions WHERE question_set_id = 2 AND original_question_number = 1;

-- Question 2 from Set 1
INSERT INTO question_versions (question_id, version_number, topic_focus, question_text, answer_choices, correct_answer)
SELECT id, 1, 'Using risk treatment to avoid unnecessary expansion risk',
'North American Furnishings considered launching a new product line that would require additional warehouse space and staffing. After evaluating potential supply chain disruptions and customer demand, the company decided not to proceed with the expansion. Which one of the following risk treatments did North American Furnishings decide to apply?',
'["A. Retain the risk", "B. Avoid the risk", "C. Transfer the risk", "D. Modify the impact of the risk"]',
'B'
FROM questions WHERE question_set_id = 2 AND original_question_number = 2;

-- Question 3 from Set 1  
INSERT INTO question_versions (question_id, version_number, topic_focus, question_text, answer_choices, correct_answer)
SELECT id, 1, 'Limiting exposure by setting aggregate limits on liability policies',
'During the 1980s liability insurance crisis, one insurer sought to better control long-term exposure by placing an overall cap on the amount it would pay out for all claims within a policy period. Which one of the following actions did this insurer take?',
'["A. Introduced general aggregate limits on liability coverage", "B. Offered policies with retroactive dates", "C. Encouraged policyholders to self-insure more risk", "D. Applied stricter claims-made reporting deadlines"]',
'A'
FROM questions WHERE question_set_id = 2 AND original_question_number = 3;

-- Add a few more to make it functional
INSERT INTO question_versions (question_id, version_number, topic_focus, question_text, answer_choices, correct_answer)
SELECT id, 1, 'Use of sensors and IoT in reducing risk and improving underwriting',
'Goshen Mutual is piloting a program that installs water leak sensors in policyholders homes. These sensors send real-time alerts to prevent property damage before it occurs. This initiative is an example of which one of the following foundations of the predict and prevent mindset?',
'["A. Climate change modeling", "B. Emerging technology", "C. Competitive pricing trends", "D. Changing regulatory frameworks"]',
'B'
FROM questions WHERE question_set_id = 2 AND original_question_number = 4;

INSERT INTO question_versions (question_id, version_number, topic_focus, question_text, answer_choices, correct_answer)
SELECT id, 1, 'Technology-related system failures in retail operations',
'Springers Attire upgraded its point-of-sale system to streamline customer checkouts. Soon after, customers began reporting double charges and frequent payment errors. This aspect of Springers Attires operating risk is',
'["A. Process risk.", "B. Systems risk.", "C. People risk.", "D. Event risk."]',
'B'
FROM questions WHERE question_set_id = 2 AND original_question_number = 5;