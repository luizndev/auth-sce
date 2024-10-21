const mongoose = require("mongoose");

const EstagiarioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  horas: [
    {
      data: { type: String, required: true },
      horaInicio: { type: String, required: true },
      horaFim: { type: String, required: true },
      total: { type: Number, required: true },
    },
  ],
});

const Estagiario = mongoose.model("Estagiario", EstagiarioSchema);
module.exports = Estagiario;
