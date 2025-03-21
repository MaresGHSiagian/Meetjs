const socket = io();
let localStream;
const peerConnections = {};
const servers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// DOM Elements
const muteBtn = document.getElementById('muteBtn');
const cameraBtn = document.getElementById('cameraBtn');
const screenBtn = document.getElementById('screenBtn');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const chatMessages = document.getElementById('chatMessages');
const participants = document.getElementById('participants');
const endCallBtn = document.getElementById('endCallBtn');
const confirmModal = document.getElementById('confirmEndCall');
const confirmYes = document.getElementById('confirmYes');
const confirmNo = document.getElementById('confirmNo');
const chatRoom = document.getElementById('chatRoom');
const chatToggleBtn = document.getElementById('chatToggleBtn');

const joinRoomBox = document.getElementById('joinRoomBox');
const nameInput = document.getElementById('nameInput');
const roomInput = document.getElementById('roomInput');
const joinBtn = document.getElementById('joinBtn');

const roomLinkContainer = document.getElementById('roomLinkContainer');
const shareLink = document.getElementById('shareLink');
const copyBtn = document.getElementById('copyBtn');

const meetingContainer = document.getElementById('meetingContainer');

window.onload = () => {
  chatRoom.classList.add('hidden');
  const urlParams = new URLSearchParams(window.location.search);
  const roomFromUrl = urlParams.get('room');
  if (roomFromUrl) roomInput.value = roomFromUrl;
};

let myName = '';
let roomName = '';
let myRoomId = "";  // Akan diisi otomatis saat join
let myUserId = "";  // Akan diisi socket.id saat join
joinBtn.onclick = async () => {
  myName = nameInput.value.trim();
  roomName = roomInput.value.trim();

  // Validasi input
  if (!myName || !roomName) {
    alert('Please enter both your name and room name!');
    return;
  }

  // Sembunyikan box join, tampilkan meeting dan link share
  joinRoomBox.classList.add('hidden');
  meetingContainer.classList.remove('hidden');
  roomLinkContainer.classList.remove('hidden');
  chatRoom.classList.add('hidden');

  const currentUrl = `${location.origin}${location.pathname}?room=${roomName}`;
  shareLink.value = currentUrl;

  try {
    // Minta akses kamera dan mic
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

    // Tambahkan video user sendiri
    addVideo(localStream, `${myName} (You)`, socket.id, true);

    // Emit join room
    socket.emit('join-room', roomName, myName);

    // Simpan socket id user setelah join
    myUserId = socket.id;

    // Debug log
    console.log("Joined room:", roomName);
    console.log("Username:", myName);
    console.log("My Socket ID:", myUserId);

  } catch (err) {
    console.error('Media access error:', err);
    alert('Failed to access camera/mic');
  }
};

// Handle new user joined
socket.on('user-joined', ({ id, name }) => {
  const peerConnection = new RTCPeerConnection(servers);
  peerConnections[id] = peerConnection;

  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.onicecandidate = e => {
    if (e.candidate) {
      socket.emit('ice-candidate', { to: id, candidate: e.candidate });
    }
  };

  peerConnection.ontrack = e => {
    if (!document.getElementById(`video-${id}`)) {
      addVideo(e.streams[0], name, id, false);
    }
  };

  peerConnection.createOffer().then(offer => {
    peerConnection.setLocalDescription(offer);
    socket.emit('offer', { to: id, offer });
  });
});

// Handle offer received
socket.on('offer', async ({ from, offer }) => {
  const peerConnection = new RTCPeerConnection(servers);
  peerConnections[from] = peerConnection;

  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.onicecandidate = e => {
    if (e.candidate) {
      socket.emit('ice-candidate', { to: from, candidate: e.candidate });
    }
  };

  peerConnection.ontrack = e => {
    if (!document.getElementById(`video-${from}`)) {
      addVideo(e.streams[0], `User ${from}`, from, false);
    }
  };

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('answer', { to: from, answer });
});

// Handle answer received
socket.on('answer', ({ from, answer }) => {
  const peerConnection = peerConnections[from];
  peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

// Handle ICE candidate received
socket.on('ice-candidate', ({ from, candidate }) => {
  const peerConnection = peerConnections[from];
  if (peerConnection) {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }
});

// Handle user leaving
socket.on('user-left', ({ id }) => {
  if (peerConnections[id]) {
    peerConnections[id].close();
    delete peerConnections[id];
  }
  const videoElem = document.getElementById(`video-${id}`);
  if (videoElem) videoElem.parentElement.remove();
});

// Add video to DOM
function addVideo(stream, label, id, isSelf) {
  const div = document.createElement('div');
  div.className = 'participant';
  div.id = `user-${id}`;

  const video = document.createElement('video');
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  video.id = `video-${id}`;

  const nameLabel = document.createElement('p');
  nameLabel.textContent = label;
  nameLabel.className = 'name-label';

  const placeholder = document.createElement('div');
  placeholder.className = 'placeholder-name';
  const initials = getInitials(label);
  placeholder.textContent = initials;

  div.appendChild(video);
  div.appendChild(placeholder);
  div.appendChild(nameLabel);
  participants.appendChild(div);

  video.onloadedmetadata = () => {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack.enabled) {
      video.classList.add('hidden');
      placeholder.classList.add('visible-placeholder');
    }
  };

  stream.getVideoTracks()[0].onended = () => {
    video.classList.add('hidden');
    placeholder.classList.add('visible-placeholder');
  };

  if (isSelf) {
    videoTrackListener(video, placeholder);
  }
}

// Get user initials
function getInitials(name) {
  const cleanName = name.replace(/\(.*?\)/g, '').trim();
  const parts = cleanName.split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Toggle camera
cameraBtn.onclick = () => {
  const videoTrack = localStream.getVideoTracks()[0];
  videoTrack.enabled = !videoTrack.enabled;
  cameraBtn.textContent = videoTrack.enabled ? '🎥' : '📷';

  const userVideo = document.querySelector(`#user-${socket.id} video`);
  const placeholder = document.querySelector(`#user-${socket.id} .placeholder-name`);

  if (videoTrack.enabled) {
    userVideo.classList.remove('hidden');
    placeholder.classList.remove('visible-placeholder');
  } else {
    userVideo.classList.add('hidden');
    placeholder.classList.add('visible-placeholder');
  }
};

// Video track listener
function videoTrackListener(video, placeholder) {
  const track = localStream.getVideoTracks()[0];
  track.onmute = () => {
    video.classList.add('hidden');
    placeholder.classList.add('visible-placeholder');
  };
  track.onunmute = () => {
    video.classList.remove('hidden');
    placeholder.classList.remove('visible-placeholder');
  };
}

// Copy room link
copyBtn.onclick = () => {
  shareLink.select();
  document.execCommand('copy');
  alert('Link copied to clipboard!');
};

// Mute/unmute mic
muteBtn.onclick = () => {
  const audioTrack = localStream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;
  muteBtn.textContent = audioTrack.enabled ? '🎤' : '🔇';
};

// Screen sharing
screenBtn.onclick = async () => {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const screenTrack = screenStream.getVideoTracks()[0];

    for (let userId in peerConnections) {
      const sender = peerConnections[userId].getSenders().find(s => s.track.kind === 'video');
      sender.replaceTrack(screenTrack);
    }

    screenBtn.textContent = '🛑'; // Stop screen share icon

    screenTrack.onended = () => {
      for (let userId in peerConnections) {
        const sender = peerConnections[userId].getSenders().find(s => s.track.kind === 'video');
        sender.replaceTrack(localStream.getVideoTracks()[0]);
      }
      screenBtn.textContent = '🖥️'; // Share screen icon
    };
  } catch (err) {
    console.error('Screen share error:', err);
  }
};



// Tombol Join Room
joinBtn.onclick = async () => {
  myName = nameInput.value.trim();
  const roomNameInput = roomInput.value.trim();

  if (!myName || !roomNameInput) {
    alert('Please enter both your name and room name!');
    return;
  }

  // Update UI
  joinRoomBox.classList.add('hidden');
  meetingContainer.classList.remove('hidden');
  roomLinkContainer.classList.remove('hidden');
  chatRoom.classList.add('hidden');

  // Buat link share room
  const currentUrl = `${location.origin}${location.pathname}?room=${roomNameInput}`;
  shareLink.value = currentUrl;

  try {
    // Akses kamera dan mic
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    addVideo(localStream, `${myName} (You)`, socket.id, true);

    // Set variabel room dan user ID
    myRoomId = roomNameInput;
    myUserId = socket.id;

    // Emit join-room ke server
    socket.emit('join-room', myRoomId, myName);
  } catch (err) {
    console.error('Media access error:', err);
    alert('Failed to access camera/mic');
  }
};

// Kirim Chat ke Server & Tambah ke UI
sendBtn.onclick = () => {
  const msg = chatInput.value.trim();

  if (msg && myRoomId && myUserId && myName) {
    const data = {
      room_id: myRoomId,
      user_id: myUserId,
      sender: myName,
      message: msg
    };

    socket.emit("chat", data);
    addChat("You", msg, true);  // Tandai sebagai pesan sendiri
    chatInput.value = "";
  } else {
    alert("Pesan kosong atau belum join room/user.");
  }
};

// Terima Chat dari Server
socket.on("chat", (data) => {
  if (data.sender && data.message) {
    if (data.sender !== myName) {
      addChat(data.sender, data.message, false);
    }
  } else {
    console.warn("⚠️ Data chat tidak valid:", data);
  }
});

// Fungsi Tambah Chat ke UI
function addChat(sender, msg, isSelf) {
  const p = document.createElement("p");
  p.textContent = `${sender}: ${msg}`;
  chatMessages.appendChild(p);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Toggle Chat Room
chatToggleBtn.onclick = () => {
  chatRoom.classList.toggle('hidden');
};


// enter
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    sendBtn.click();
  }
});


// End call confirmation
endCallBtn.onclick = () => {
  confirmModal.style.display = 'flex';
};

confirmYes.onclick = () => {
  for (let userId in peerConnections) {
    peerConnections[userId].close();
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  participants.innerHTML = '';
  socket.disconnect();
  location.reload();
};

confirmNo.onclick = () => {
  confirmModal.classList.add('hidden');
  confirmModal.style.display = 'none'; // Pastikan modal benar-benar hilang
};


// untuk close chat
  // Buka Chat
  chatToggleBtn.addEventListener("click", function () {
    chatRoom.classList.remove("hidden"); // Tampilkan chat
  });

  // Tutup Chat
  chatCloseBtn.addEventListener("click", function () {
    chatRoom.classList.add("hidden"); // Sembunyikan chat
  });

