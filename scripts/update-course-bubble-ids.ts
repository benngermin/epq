import { db } from "../server/db";
import { courses } from "../shared/schema";
import { eq } from "drizzle-orm";

const courseBubbleIdMapping = [
  {
    "course number": "AIC 300",
    "course title": "Claims in an Evolving World",
    "unique id": "1750879028142x913672297609765500"
  },
  {
    "course number": "AIC 304",
    "course title": "Successfully Evaluating Property Claims",
    "unique id": "1750879028143x319068075921874500"
  },
  {
    "course number": "AIC 305",
    "course title": "Successfully Evaluating Workers Compensation Claims",
    "unique id": "1750879028143x383357838219731800"
  },
  {
    "course number": "CPCU 520",
    "course title": "Meeting Challenges Across Insurance Operations",
    "unique id": "1750879028143x507184606995831900"
  },
  {
    "course number": "AIC 330",
    "course title": "Leading a Successful Claims Team",
    "unique id": "1750879028143x507252562881439500"
  },
  {
    "course number": "AIC 303",
    "course title": "Successfully Evaluating Liability Claims",
    "unique id": "1750879028143x632183863337632600"
  },
  {
    "course number": "CPCU 530",
    "course title": "Applying Legal Concepts to Insurance",
    "unique id": "1750879028143x656842992169660800"
  },
  {
    "course number": "CPCU 500",
    "course title": "Becoming a Leader in Risk Management and Insurance",
    "unique id": "1750879028143x766136545617023100"
  },
  {
    "course number": "AIC 301",
    "course title": "Expanding Your Claims Perspective",
    "unique id": "1750879028143x808690346599446800"
  },
  {
    "course number": "AIC 302",
    "course title": "Successfully Evaluating Auto Claims",
    "unique id": "1750879028143x952584127540198900"
  },
  {
    "course number": "CPCU 550",
    "course title": "Maximizing Value with Data and Technology",
    "unique id": "1750879028145x388043314134105100"
  },
  {
    "course number": "CPCU 540",
    "course title": "Contributing to Insurer Financial Performance",
    "unique id": "1750879028145x747107590554081200"
  },
  {
    "course number": "CPCU 556",
    "course title": "Building a Competitive Edge in Personal Lines",
    "unique id": "1752573908287x983119325609069300"
  },
  {
    "course number": "CPCU 555",
    "course title": "Advancing Personal Insurance Products",
    "unique id": "1752574017336x671309298229491200"
  },
  {
    "course number": "CPCU 552",
    "course title": "Managing Commercial Liability Risk",
    "unique id": "1752574051752x381186012513885950"
  },
  {
    "course number": "CPCU 551",
    "course title": "Managing Commercial Property Risk",
    "unique id": "1752574085775x658452373247050000"
  }
];

async function updateCourseBubbleIds() {
  console.log("Updating course Bubble IDs...");
  
  for (const courseMapping of courseBubbleIdMapping) {
    try {
      // Try to find course by title (course number)
      const result = await db.update(courses)
        .set({ bubbleUniqueId: courseMapping["unique id"] })
        .where(eq(courses.title, courseMapping["course number"]))
        .returning();
      
      if (result.length > 0) {
        console.log(`✅ Updated ${courseMapping["course number"]} with Bubble ID ${courseMapping["unique id"]}`);
      } else {
        console.log(`⚠️ Course ${courseMapping["course number"]} not found in database`);
      }
    } catch (error) {
      console.error(`❌ Error updating ${courseMapping["course number"]}:`, error);
    }
  }
  
  console.log("Done!");
  process.exit(0);
}

updateCourseBubbleIds().catch(console.error);