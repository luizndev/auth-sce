require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors"); // Importando o cors
const Estagiario = require("./models/Estagiario");
const bodyParser = require("body-parser");
const fs = require("fs");
const { Parser } = require("json2csv");

const app = express();

// Habilitando o CORS
app.use(cors());

app.use(bodyParser.json());
app.use(express.static("frontend"));

// Conexão ao MongoDB
mongoose
  .connect(
    `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.MONGO_CLUSTER_URL}/${process.env.MONGO_DATABASE}?retryWrites=true&w=majority`,
    { useNewUrlParser: true, useUnifiedTopology: true }
  )
  .then(() => console.log("Conectado ao MongoDB"))
  .catch((err) => console.log("Erro ao conectar ao MongoDB: " + err));

// Rota para cadastrar estagiário
app.post("/api/estagiarios", async (req, res) => {
  const { nome, email } = req.body;
  const novoEstagiario = new Estagiario({ nome, email, horas: [] });
  await novoEstagiario.save();
  res.json(novoEstagiario);
});

// Rota para obter estagiário por ID (incluindo horas)
app.get("/api/estagiarios/:id", async (req, res) => {
  const { id } = req.params;
  const estagiario = await Estagiario.findById(id);
  res.json(estagiario);
});

// Rota para listar estagiários
app.get("/api/estagiarios", async (req, res) => {
  const estagiarios = await Estagiario.find();
  res.json(estagiarios);
});

// Rota para obter horas de um estagiário por ID
app.get("/api/estagiarios/:id/horas", async (req, res) => {
  const { id } = req.params;
  const estagiario = await Estagiario.findById(id);

  if (!estagiario) {
    return res.status(404).json({ message: "Estagiário não encontrado." });
  }

  res.json(estagiario.horas); // Retorna apenas as horas
});

// Rota para adicionar horas
app.post("/api/estagiarios/:id/horas", async (req, res) => {
  const { id } = req.params;
  const { data, horaInicio, horaFim } = req.body; // Corrigido para horaInicio e horaFim

  // Verificar se todos os campos foram preenchidos
  if (!data || !horaInicio || !horaFim) {
    return res.status(400).json({
      message: "Todos os campos (data, horaInicio, horaFim) são obrigatórios.",
    });
  }

  try {
    const estagiario = await Estagiario.findById(id);
    if (!estagiario) {
      return res.status(404).json({ message: "Estagiário não encontrado." });
    }

    // Calcular o total de horas
    const inicioDate = new Date(`${data}T${horaInicio}`);
    const fimDate = new Date(`${data}T${horaFim}`);
    const totalMinutos = (fimDate - inicioDate) / (1000 * 60); // Diferença em minutos

    // Verificar se o tempo trabalhado é válido
    if (totalMinutos < 0) {
      return res
        .status(400)
        .json({ message: "O horário de fim deve ser maior que o de início." });
    }

    // Determinar o turno
    const turno = inicioDate.getHours() < 12 ? "manhã" : "tarde";

    // Verificar se já existe uma carga horária para o mesmo dia e turno
    const hasEntry = estagiario.horas.some((hora) => {
      const existingDate = new Date(`${hora.data}T${hora.horaInicio}`);
      return (
        hora.data === data && // Verifica se a data é a mesma
        (turno === "manhã"
          ? existingDate.getHours() < 12
          : existingDate.getHours() >= 13) // Verifica o turno
      );
    });

    if (hasEntry) {
      return res.status(400).json({
        message: `Já existe uma carga horária registrada para o turno ${turno} neste dia.`,
      });
    }

    estagiario.horas.push({ data, horaInicio, horaFim, total: totalMinutos });
    await estagiario.save();

    res.status(201).json(estagiario);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao adicionar horas." });
  }
});

app.get("/api/exportar", async (req, res) => {
  const estagiarios = await Estagiario.find();
  const dataToExport = estagiarios.map((estagiario) => {
    const totalHoras = estagiario.horas.reduce(
      (total, hora) => total + (hora.total || 0),
      0
    ); // Soma total de minutos
    return {
      nome: estagiario.nome,
      email: estagiario.email,
      totalHoras: Math.floor(totalHoras / 60), // Total em horas
      totalMinutos: totalHoras % 60, // Minutos restantes
    };
  });

  const json2csvParser = new Parser();
  const csv = json2csvParser.parse(dataToExport);

  fs.writeFileSync("estagiarios.csv", csv);
  res.download("estagiarios.csv");
});

// Rota para remover estagiário
app.delete("/api/estagiarios/:id", async (req, res) => {
  const { id } = req.params;
  await Estagiario.findByIdAndDelete(id);
  res.sendStatus(204);
});

app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});

// Open Route
app.get("/", (req, res) => {
  res.status(200).json({ message: "Bem vindo a api" });
});
