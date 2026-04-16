import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.join(__dirname, 'schema.prisma');
let content = fs.readFileSync(schemaPath, 'utf8');

const targetIndex = content.indexOf('model DreamTeam {');
if (targetIndex !== -1) {
  content = content.substring(0, targetIndex);
}

const appendText = `model DreamTeam {
  id          Int      @id @default(autoincrement())
  userId      Int      
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  competitionId Int?   
  competition Competition?  @relation(fields: [competitionId], references: [id])
  
  formation   String   @default("1-2-1") // E.g., 1-2-1, 1-1-2, 2-1-1
  updatedAt   DateTime @updatedAt

  gkId        Int?
  gk          Player?  @relation("GK", fields: [gkId], references: [id])
  def1Id      Int?
  def1        Player?  @relation("DEF1", fields: [def1Id], references: [id])
  def2Id      Int?
  def2        Player?  @relation("DEF2", fields: [def2Id], references: [id])
  mid1Id      Int?
  mid1        Player?  @relation("MID1", fields: [mid1Id], references: [id])
  mid2Id      Int?
  mid2        Player?  @relation("MID2", fields: [mid2Id], references: [id])
  fwd1Id      Int?
  fwd1        Player?  @relation("FWD1", fields: [fwd1Id], references: [id])
  fwd2Id      Int?
  fwd2        Player?  @relation("FWD2", fields: [fwd2Id], references: [id])

  @@unique([userId, competitionId])
}

model OutrightPrediction {
  id                Int      @id @default(autoincrement())
  userId            Int      
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  competitionId     Int?   
  competition       Competition?  @relation(fields: [competitionId], references: [id])
  
  championTeam      String?
  runnerUpTeam      String?
  
  topScorerId       Int?
  topScorer         Player?  @relation("TopScorer", fields: [topScorerId], references: [id])
  bestPlayerId      Int?
  bestPlayer        Player?  @relation("BestPlayer", fields: [bestPlayerId], references: [id])

  updatedAt         DateTime @updatedAt

  @@unique([userId, competitionId])
}
`;

fs.writeFileSync(schemaPath, content + appendText);
console.log('Schema reformatted correctly.');
