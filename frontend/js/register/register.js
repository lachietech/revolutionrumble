const form = document.getElementById('form');
const success = document.getElementById('success');
const payBtn = document.getElementById('pay');

function genId(){
    return 'RR-' + Math.random().toString(36).slice(2,7).toUpperCase();
}

form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const data = {
        fullName: form.fullName.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim(),
        center: form.center.value.trim(),
        division: form.division.value,
        hand: form.hand.value,
        avg: form.avg.value ? Number(form.avg.value) : null,
        sanction: form.sanction.value.trim(),
        notes: form.notes.value.trim(),
        agree: form.agree.checked,
        createdAt: new Date().toISOString(),
    };

    // basic validation
    if(!data.fullName || !data.email || !data.phone || !data.division || !data.agree){
        success.style.display='block';
        success.style.borderColor = 'rgba(255,80,80,.45)';
        success.style.background = 'rgba(255,80,80,.12)';
        success.textContent = 'Please complete all required fields.';
        return;
    }

    const id = genId();
    const entries = JSON.parse(localStorage.getItem('rr_entries')||'[]');
    entries.push({...data, id});
    localStorage.setItem('rr_entries', JSON.stringify(entries));

    success.style.display='block';
    success.style.borderColor = 'rgba(46,143,220,.35)';
    success.style.background = 'rgba(46,143,220,.12)';
    success.innerHTML = `<strong>Entry received!</strong> Your confirmation number is <code>${id}</code>.`;
    form.reset();
    form.querySelector('#hand').value='R';
});

payBtn.addEventListener('click',()=>{
    alert('Stub: integrate Stripe/checkout here or redirect to payment portal.');
});