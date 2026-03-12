// js/animation.js

const bodyGroup = document.getElementById('body-group');
const arms = { l: document.getElementById('arm-left'), r: document.getElementById('arm-right') };
const legs = { l: document.getElementById('leg-left'), r: document.getElementById('leg-right') };
const feet = { l: document.getElementById('foot-left'), r: document.getElementById('foot-right') };

// Pose Neutre (Repos)
const idlePose = { y: 0, al: "M 85 95 L 70 130 L 65 160", ar: "M 115 95 L 130 130 L 135 160", ll: "M 92 165 L 90 215 L 90 265", lr: "M 110 165 L 110 215 L 110 265" };

/**
 * Déclenche UN mouvement de pas selon le côté reçu du Bluetooth
 */
function animateStep(side) {
    const isLeft = (side === 'L');
    
    // Pose dynamique de l'impact
    const stepPose = {
        y: -6, 
        al: isLeft ? "M 85 95 L 100 110 L 110 80" : "M 85 95 L 70 130 L 65 160", 
        ar: isLeft ? "M 115 95 L 130 130 L 135 160" : "M 115 95 L 100 110 L 90 80",
        ll: isLeft ? "M 92 165 L 70 180 L 100 195" : "M 92 165 L 90 215 L 90 265",
        lr: isLeft ? "M 110 165 L 110 215 L 110 265" : "M 110 165 L 130 180 L 100 195"
    };

    applyPose(stepPose);

    // Retour au repos automatique après 150ms (très réactif)
    setTimeout(() => {
        applyPose(idlePose);
    }, 150);
}

function applyPose(p) {
    bodyGroup.style.transform = `translateY(${p.y}px)`;
    arms.l.setAttribute('d', p.al); 
    arms.r.setAttribute('d', p.ar);
    legs.l.setAttribute('d', p.ll); 
    legs.r.setAttribute('d', p.lr);
    
    // Update des petits cercles de pieds
    const getEnd = (d) => { const a = d.split(' '); return {x: a[a.length-2], y: a[a.length-1]}; };
    const fL = getEnd(p.ll), fR = getEnd(p.lr);
    feet.l.setAttribute('cx', fL.x); feet.l.setAttribute('cy', fL.y);
    feet.r.setAttribute('cx', fR.x); feet.r.setAttribute('cy', fR.y);
}

// Init
applyPose(idlePose);