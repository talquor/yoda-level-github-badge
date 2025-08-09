const { createCanvas } = require('canvas');

export default function handler(req, res) {
    const { user, rank } = req.query;
    if (!user || !rank) {
        res.status(400).send('Missing user or rank parameter');
        return;
    }

    const canvas = createCanvas(200, 40);
    const ctx = canvas.getContext('2d');

    const badgeColor = rank === 'S++' || rank === 'S+' || rank === 'S' ? '#10B981' :
                      rank === 'S-' ? '#34D399' : rank === 'S--' ? '#6EE7B7' :
                      rank === 'A+' ? '#3B82F6' : rank === 'A' ? '#60A5FA' :
                      rank === 'B+' || rank === 'B' ? '#F59E0B' :
                      rank === 'C+' || rank === 'C' || rank === 'C-' ? '#FBBF24' :
                      rank === 'D+' || rank === 'D' || rank === 'D-' ? '#FCD34D' : '#FEF3C7';
    const title = rank === 'S++' ? 'Jedi' : rank === 'S+' ? 'Master Yoda' :
                  rank === 'S' ? 'Grand Master' : rank === 'S-' ? 'Jedi Master' :
                  rank === 'S--' ? 'Darth Vader' : rank === 'A+' ? 'Obi-Wan Kenobi' :
                  rank === 'A' ? 'Jedi Knight' : rank === 'B+' ? 'Luke Skywalker' :
                  rank === 'B' ? 'Padawan' : rank === 'C+' ? 'Youngling' :
                  rank === 'C' ? 'Initiate' : rank === 'C-' ? 'Force Apprentice' :
                  rank === 'D+' ? 'Force Learner' : rank === 'D' ? 'Force Novice' :
                  rank === 'D-' ? 'Force Newcomer' : rank === 'F+' ? 'Force Initiate' : 'Force Beginner';

    ctx.fillStyle = badgeColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`Rank: ${rank} ${title}`, 10, 25);
    ctx.font = '10px monospace';
    ctx.fillText('GitHub', 170, 25);

    res.setHeader('Content-Type', 'image/png');
    res.send(canvas.toBuffer());
}