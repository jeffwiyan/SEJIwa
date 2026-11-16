const crisisPattern = /\b(bunuh diri|mengakhiri hidup|ingin mati|tidak ingin hidup|lebih baik mati|ingin menghilang|menyakiti diri|melukai diri|self[- ]?harm|suicid(?:e|al)|kill myself|hurt myself|end my life|want to die|wish i was dead|don't want to live|not safe)\b/i;
const medicationPattern = /\b(obat|dosis|medication|medicine|pill|resep|diagnosis|diagnosa)\b/i;
const workPattern = /\b(kerja|pekerjaan|kantor|atasan|beban|burnout|lelah|stres|stress|deadline|rekan kerja)\b/i;
const anxietyPattern = /\b(cemas|cemas sekali|panik|anxiety|anxious|takut|khawatir|overthinking|gelisah)\b/i;
const sleepPattern = /\b(tidur|insomnia|sulit tidur|begadang|sleep|terbangun)\b/i;
const relationshipPattern = /\b(hubungan|pasangan|keluarga|teman|konflik|bertengkar|relationship|lonely|kesepian)\b/i;
const psychologistPattern = /\b(psikolog|psikiater|konseling|konsultasi|professional|profesional|terapis)\b/i;

export function respondToSupportQuestion(input) {
  const question = input.trim();
  if (crisisPattern.test(question)) {
    return {
      text: 'Aku turut prihatin kamu sedang menghadapi ini. Keselamatanmu yang utama. Jika kamu merasa mungkin menyakiti diri atau berada dalam bahaya sekarang, segera hubungi layanan darurat setempat atau pergi ke IGD terdekat. Jika bisa, beri tahu orang yang kamu percaya dan minta mereka menemanimu sekarang. Apakah kamu sedang dalam bahaya langsung saat ini?',
      safety: 'urgent',
    };
  }
  if (medicationPattern.test(question)) {
    return {
      text: 'Aku tidak bisa menentukan diagnosis, obat, atau dosis. Hal itu perlu dibahas dengan dokter atau tenaga kesehatan yang berwenang, terutama sebelum memulai, menghentikan, atau mengubah obat. Kalau kamu mau, ceritakan situasi yang membuatmu bertanya; aku bisa bantu menyusun hal yang ingin kamu tanyakan kepada profesional.',
      safety: 'standard',
    };
  }
  if (workPattern.test(question)) {
    return {
      text: 'Tekanan pekerjaan yang menumpuk bisa terasa berat. Kita bisa mulai dari satu langkah kecil: apa yang paling mendesak hari ini, apa yang bisa ditunda, dan siapa yang aman untuk diajak menyepakati prioritas? Jika memungkinkan, sampaikan kebutuhanmu secara spesifik kepada orang yang berwenang. Ini dukungan umum, bukan diagnosis. Bagian mana yang paling membebani saat ini?',
      safety: 'standard',
    };
  }
  if (anxietyPattern.test(question)) {
    return {
      text: 'Rasa cemas bisa membuat semuanya terasa mendesak. Jika terasa nyaman, coba berhenti sejenak dan sebutkan beberapa hal yang kamu lihat atau dengar di sekitarmu; hentikan jika justru membuatmu tidak nyaman. Kamu juga bisa memilih satu hal kecil yang terasa aman untuk dilakukan sekarang. Apa yang sedang paling kamu khawatirkan?',
      safety: 'standard',
    };
  }
  if (sleepPattern.test(question)) {
    return {
      text: 'Sulit tidur dapat dipengaruhi banyak hal dan aku tidak bisa menentukan penyebabnya. Untuk malam ini, kamu bisa mencoba rutinitas yang tenang dan mengurangi hal yang terasa menstimulasi sebelum tidur—pilih yang cocok, tanpa memaksakan diri. Jika masalah tidur berlangsung, mengganggu aktivitas, atau membuatmu khawatir, bicarakan dengan tenaga kesehatan. Sudah berapa lama ini terjadi?',
      safety: 'standard',
    };
  }
  if (relationshipPattern.test(question)) {
    return {
      text: 'Situasi hubungan bisa membawa banyak perasaan sekaligus. Mungkin membantu untuk memisahkan apa yang terjadi, apa yang kamu rasakan, dan apa yang kamu butuhkan sebelum menentukan langkah berikutnya. Jika ada ancaman atau kamu tidak merasa aman, utamakan pergi ke tempat aman dan hubungi orang yang kamu percaya atau layanan darurat setempat. Apa yang terjadi baru-baru ini?',
      safety: 'standard',
    };
  }
  if (psychologistPattern.test(question)) {
    return {
      text: 'Mencari bantuan profesional adalah pilihan yang wajar. Kamu bisa membuka menu Daftar Psikolog untuk melihat profil yang tersedia. Profil di versi demonstrasi ini belum terverifikasi dan belum menjamin jadwal layanan; untuk bantuan klinis, pastikan kredensial dan ketersediaan tenaga profesional secara langsung. Apa dukungan yang sedang kamu cari?',
      safety: 'standard',
    };
  }
  return {
    text: 'Terima kasih sudah bercerita. Aku adalah asisten otomatis SEJIWA, bukan psikolog; aku tidak dapat mendiagnosis atau menggantikan bantuan profesional. Aku bisa membantu memikirkan langkah dukungan umum. Bisa ceritakan sedikit lebih spesifik apa yang terjadi dan dukungan seperti apa yang kamu harapkan?',
    safety: 'standard',
  };
}
