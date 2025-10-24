// Configuració - ACTUALIZADO para Node.jsback
const API_URL = "https://www.filomatch-back.piterxus.com/api";

// Variables globals
let surveyQuestions = [];
let currentUser = "";

document.addEventListener("DOMContentLoaded", function () {
  // Configurar control de acceso PRIMERO
  setupAccessControl();

  // Carregar preguntes en iniciar
  loadQuestions();

  // Configurar esdeveniments
  setupEventListeners();

  // Actualitzar llista d'usuaris
  loadUsers();
});
// Carregar preguntes des del servidor - ACTUALIZADO
async function loadQuestions() {
  try {
    const response = await fetch(`${API_URL}/preguntes`);
    const data = await response.json();

    if (data.error) {
      showError("survey", "Error en carregar preguntes: " + data.error);
      return;
    }

    surveyQuestions = data;
    generateQuestions();
  } catch (error) {
    showError("survey", "Error de connexió: " + error.message);
  }
}

// Generar les preguntes al DOM
function generateQuestions() {
  const container = document.getElementById("questionsContainer");
  container.innerHTML = "";

  surveyQuestions.forEach((question) => {
    const questionElement = document.createElement("div");
    questionElement.className = "question";

    const questionText = document.createElement("div");
    questionText.className = "question-text";
    questionText.textContent = question.text;
    questionElement.appendChild(questionText);

    const optionsContainer = document.createElement("div");
    optionsContainer.className = "options";

    question.options.forEach((option, index) => {
      const optionId = `q${question.id}_opt${index}`;

      const optionElement = document.createElement("label");
      optionElement.className = "option";
      optionElement.innerHTML = `
                        <input type="radio" name="question_${question.id}" value="${index}" id="${optionId}">
                        ${option}
                    `;

      optionsContainer.appendChild(optionElement);
    });

    questionElement.appendChild(optionsContainer);
    container.appendChild(questionElement);
  });
}

// Configurar event listeners
function setupEventListeners() {
  // Enviament d'enquesta
  document
    .getElementById("submitSurvey")
    .addEventListener("click", submitSurvey);

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", function () {
      const tabName = this.dataset.tab;

      // Si son pestañas restringidas y no hay acceso, mostrar modal
      if (
        (tabName === "results" || tabName === "admin") &&
        !hasExpositorAccess
      ) {
        showAccessModal();
        return; // No cambiar de pestaña
      }

      // Cambiar de pestaña normalmente
      switchToTab(tabName);

      // Si és la pestanya de resultats, calcular match
      if (tabName === "results") {
        calculateAndDisplayMatches();
      } else if (tabName === "admin") {
        loadUsers();
      }
    });
  });

  // Controls d'administració
  document
    .getElementById("viewAllMatches")
    .addEventListener("click", showAllMatches);
  document.getElementById("reloadUsers").addEventListener("click", loadUsers);

  // Selecció d'opcions
  document.addEventListener("click", function (e) {
    if (e.target.closest(".option")) {
      const option = e.target.closest(".option");
      const radio = option.querySelector('input[type="radio"]');
      radio.checked = true;

      // Actualitzar estils visuals
      option.parentNode.querySelectorAll(".option").forEach((opt) => {
        opt.classList.remove("selected");
      });
      option.classList.add("selected");
    }
  });
}

// Enviar enquesta al servidor - ACTUALIZADO
async function submitSurvey() {
  const userName = document.getElementById("userName").value.trim();

  if (!userName) {
    showError("survey", "Si us plau, introdueix el teu nom.");
    return;
  }

  // Recopilar respostes
  const responses = {};
  let allAnswered = true;

  surveyQuestions.forEach((question) => {
    const selectedOption = document.querySelector(
      `input[name="question_${question.id}"]:checked`
    );

    if (selectedOption) {
      responses[question.id] = parseInt(selectedOption.value);
    } else {
      allAnswered = false;
    }
  });

  if (!allAnswered) {
    showError("survey", "Si us plau, respon totes les preguntes.");
    return;
  }

  // Deshabilitar botó mentre s'envia
  const submitButton = document.getElementById("submitSurvey");
  submitButton.disabled = true;
  submitButton.textContent = "Enviant...";

  try {
    const response = await fetch(`${API_URL}/respostes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nom: userName,
        respostes: responses,
      }),
    });

    const data = await response.json();

    if (data.error) {
      showError("survey", "Error en guardar respostes: " + data.error);
    } else {
      currentUser = userName;
      alert(`Gràcies ${userName}! Les teves respostes han estat guardades.`);

      // Netejar formulari
      document.getElementById("userName").value = "";
      document.querySelectorAll('input[type="radio"]').forEach((radio) => {
        radio.checked = false;
      });
      document.querySelectorAll(".option").forEach((option) => {
        option.classList.remove("selected");
      });

      // Actualitzar llista d'usuaris
      loadUsers();
    }
  } catch (error) {
    showError("survey", "Error de connexió: " + error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Enviar Respostes";
  }
}

// Calcular i mostrar matches - ACTUALIZADO
// Calcular i mostrar matches - ACTUALIZADO Y CORREGIDO
async function calculateAndDisplayMatches() {
  const matchesContainer = document.getElementById("matchesContainer");
  const noResultsMessage = document.getElementById("noResultsMessage");
  const resultsError = document.getElementById("resultsError");

  matchesContainer.innerHTML =
    '<div class="loading">Calculant matches...</div>';
  noResultsMessage.style.display = "none";
  resultsError.style.display = "none";

  if (!currentUser) {
    const userName = prompt(
      "Si us plau, introdueix el teu nom per veure els teus matches:"
    );
    if (!userName) return;
    currentUser = userName;
  }

  try {
    const response = await fetch(`${API_URL}/matches`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nom_usuari: currentUser,
      }),
    });

    const data = await response.json();

    if (data.error) {
      resultsError.textContent = "Error: " + data.error;
      resultsError.style.display = "block";
      matchesContainer.innerHTML = "";
      return;
    }

    matchesContainer.innerHTML = "";

    if (data.length === 0) {
      noResultsMessage.style.display = "block";
      return;
    }

    // Mostrar matches
    let hasPerfectMatch = false;

    data.forEach((match) => {
      const matchCard = document.createElement("div");
      const isPerfectMatch = match.similitud === 100;

      if (isPerfectMatch) {
        matchCard.className = "match-card perfect-match heart-container";
        hasPerfectMatch = true;
      } else {
        matchCard.className = "match-card heart-container";
      }

      matchCard.innerHTML = `
                <div class="match-percentage">${match.similitud}%</div>
                <div class="match-info">
                    <div class="match-names">
                        ${currentUser} & ${match.usuari}
                        ${
                          isPerfectMatch
                            ? '<span class="perfect-match-badge">MATCH PERFECTE! 🎯</span>'
                            : ""
                        }
                    </div>
                    <div class="match-details">Teniu ${
                      match.respostes_iguals
                    } respostes similars de ${
        match.total_preguntes
      } preguntes</div>
                </div>
            `;

      matchesContainer.appendChild(matchCard);

      // Generar corazones según el porcentaje de match
      generateHearts(matchCard, match.similitud);
    });

    // Efectos especiales para match perfecto
    if (hasPerfectMatch) {
      showPerfectMatchCelebration();
    }
  } catch (error) {
    resultsError.textContent = "Error de connexió: " + error.message;
    resultsError.style.display = "block";
    matchesContainer.innerHTML = "";
  }
}

// Carregar llista d'usuaris - ACTUALIZADO
async function loadUsers() {
  const userList = document.getElementById("userList");
  const usersError = document.getElementById("usersError");

  userList.innerHTML = '<li class="loading">Carregant usuaris...</li>';
  usersError.style.display = "none";

  try {
    const response = await fetch(`${API_URL}/usuaris`);
    const data = await response.json();

    if (data.error) {
      usersError.textContent = "Error: " + data.error;
      usersError.style.display = "block";
      return;
    }

    userList.innerHTML = "";

    if (data.length === 0) {
      userList.innerHTML = "<li>No hi ha usuaris registrats</li>";
      return;
    }

    data.forEach((user) => {
      const listItem = document.createElement("li");
      listItem.innerHTML = `
                        <span>${user.nom}</span>
                        <span class="highlight">${user.comptador_respostes} respostes</span>
                    `;
      userList.appendChild(listItem);
    });
  } catch (error) {
    usersError.textContent = "Error de connexió: " + error.message;
    usersError.style.display = "block";
  }
}

// Mostrar tots els matches (vista d'administrador) - ACTUALIZADO
async function showAllMatches() {
  const container = document.getElementById("allMatchesContainer");
  container.innerHTML =
    '<div class="loading">Calculant tots els matches...</div>';

  try {
    const response = await fetch(`${API_URL}/tots-matches`);
    const data = await response.json();

    if (data.error) {
      container.innerHTML = `<div class="error">Error: ${data.error}</div>`;
      return;
    }

    container.innerHTML = "<h3>Tots els match del grup</h3>";

    if (data.length === 0) {
      container.innerHTML +=
        "<p>No hi ha suficients usuaris per calcular match.</p>";
      return;
    }

    // Mostrar resultats
    data.forEach((match) => {
      const matchCard = document.createElement("div");
      matchCard.className = "match-card";

      matchCard.innerHTML = `
                        <div class="match-percentage">${match.similitud}%</div>
                        <div class="match-info">
                            <div class="match-names">${match.usuaris[0]} & ${match.usuaris[1]}</div>
                            <div class="match-details">Teniu ${match.respostes_iguals} respostes similars de ${match.total_preguntes} preguntes</div>
                        </div>
                    `;

      container.appendChild(matchCard);
      generateHearts(matchCard, match.similitud);
    });
  } catch (error) {
    container.innerHTML = `<div class="error">Error de connexió: ${error.message}</div>`;
  }
}

// Mostrar missatge d'error
function showError(section, message) {
  const errorElement =
    document.getElementById(`${section}Error`) ||
    document.getElementById("errorMessage");
  errorElement.textContent = message;
  errorElement.style.display = "block";

  // Amagar error després de 5 segons
  setTimeout(() => {
    errorElement.style.display = "none";
  }, 5000);
}

// Función para generar corazones animados
function generateHearts(matchCard, matchPercentage) {
  // Número de corazones basado en el porcentaje de match
  let heartCount;

  if (matchPercentage === 100) {
    heartCount = 15; // Muchos corazones para match perfecto
  } else if (matchPercentage >= 80) {
    heartCount = 8;
  } else if (matchPercentage >= 60) {
    heartCount = 5;
  } else if (matchPercentage >= 40) {
    heartCount = 3;
  } else {
    heartCount = 1; // Al menos un corazoncito
  }

  // Crear corazones
  for (let i = 0; i < heartCount; i++) {
    setTimeout(() => {
      createHeart(matchCard, matchPercentage);
    }, i * 200); // Espaciado entre corazones
  }

  // Si es un buen match, añadir efecto hover con más corazones
  if (matchPercentage >= 60) {
    matchCard.addEventListener("mouseenter", function () {
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          createHeart(matchCard, matchPercentage);
        }, i * 150);
      }
    });
  }
}
// Función para mostrar celebración de match perfecto
function showPerfectMatchCelebration() {
  // Mostrar alerta especial
  setTimeout(() => {
    alert(
      "🎉 MATCH PERFECTE TROBAT! 🎉\n\nÉs l'ànima bessona de les respostes!"
    );
  }, 500);
}
// Función para crear un corazón individual
function createHeart(container, matchPercentage) {
  const heart = document.createElement("div");
  heart.className = "heart";

  // Elegir color basado en el porcentaje
  const heartTypes = ["red", "pink", "orange", "yellow", "purple"];
  let heartType;

  if (matchPercentage === 100) {
    heartType = heartTypes[Math.floor(Math.random() * heartTypes.length)]; // Aleatorio para match perfecto
  } else if (matchPercentage >= 80) {
    heartType = "red";
  } else if (matchPercentage >= 60) {
    heartType = "pink";
  } else if (matchPercentage >= 40) {
    heartType = "orange";
  } else {
    heartType = "yellow";
  }

  heart.classList.add(heartType);

  // Posición aleatoria dentro de la card
  const cardRect = container.getBoundingClientRect();
  const startX = Math.random() * (cardRect.width - 30);
  const startY = cardRect.height - 10;

  heart.style.left = startX + "px";
  heart.style.top = startY + "px";

  // Tamaño aleatorio
  const size = 15 + Math.random() * 15;
  heart.style.fontSize = size + "px";

  // Animación personalizada
  const animation = heart.animate(
    [
      {
        transform: `translateY(0) scale(0.5)`,
        opacity: 0.8,
      },
      {
        transform: `translateY(-${30 + Math.random() * 40}px) scale(1)`,
        opacity: 1,
      },
      {
        transform: `translateY(-${60 + Math.random() * 40}px) scale(0.8)`,
        opacity: 0,
      },
    ],
    {
      duration: 2000 + Math.random() * 1000,
      easing: "cubic-bezier(0.1, 0.8, 0.3, 1)",
    }
  );

  container.appendChild(heart);

  // Eliminar el corazón después de la animación
  animation.onfinish = () => {
    heart.remove();
  };
}

// Configuración de acceso
const EXPOSITOR_PASSWORD = "filomatch2024"; // Cambia esta contraseña
let hasExpositorAccess = false;

// Función para mostrar el modal de acceso
function showAccessModal() {
  // Primero asegurarse de volver a la pestaña de encuesta
  switchToTab("survey");

  // Luego mostrar el modal
  document.getElementById("accessModal").style.display = "flex";
  document.getElementById("accessPassword").focus();
}

// Función para verificar acceso
function setupAccessControl() {
  // Verificar que los elementos existen
  const resultsTab = document.getElementById("resultsTab");
  const adminTab = document.getElementById("adminTab");

  if (!resultsTab || !adminTab) {
    console.error("No se encontraron las pestañas de acceso restringido");
    return;
  }

  // Event listener para cuando se concede acceso
  document
    .getElementById("confirmAccess")
    .addEventListener("click", function () {
      const password = document.getElementById("accessPassword").value;

      if (password === EXPOSITOR_PASSWORD) {
        hasExpositorAccess = true;
        document.getElementById("accessModal").style.display = "none";
        document.getElementById("accessPassword").value = "";

        // Mostrar pestañas desbloqueadas
        resultsTab.innerHTML = resultsTab.innerHTML.replace(" 🔒", "");
        adminTab.innerHTML = adminTab.innerHTML.replace(" 🔒", "");
        resultsTab.classList.add("unlocked");
        adminTab.classList.add("unlocked");

        alert("✅ Accés concedit. Ara pots veure els resultats.");
      } else {
        alert(
          "❌ Contrasenya incorrecta. Posa't en contacte amb les expositors."
        );
        document.getElementById("accessPassword").value = "";
        document.getElementById("accessPassword").focus();
      }
    });

  document
    .getElementById("cancelAccess")
    .addEventListener("click", function () {
      document.getElementById("accessModal").style.display = "none";
      document.getElementById("accessPassword").value = "";
      // Al cancelar, asegurarse de que vuelve a la pestaña de encuesta
      switchToTab("survey");
    });

  // Cerrar modal con ESC
  document.addEventListener("keydown", function (e) {
    if (
      e.key === "Escape" &&
      document.getElementById("accessModal").style.display === "flex"
    ) {
      document.getElementById("accessModal").style.display = "none";
      switchToTab("survey");
    }
  });

  // Cerrar modal haciendo clic fuera
  document
    .getElementById("accessModal")
    .addEventListener("click", function (e) {
      if (e.target === this) {
        document.getElementById("accessModal").style.display = "none";
        switchToTab("survey");
      }
    });
}

// Función auxiliar para cambiar de pestaña
function switchToTab(tabName) {
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".tab-content")
    .forEach((c) => c.classList.remove("active"));

  document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");
  document.getElementById(tabName).classList.add("active");
}
