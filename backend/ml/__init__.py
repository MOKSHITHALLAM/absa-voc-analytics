"""Machine-learning core for the ABSA & Voice of Customer Analytics project.

Reproduces the methodology of the team paper "Aspect Based Sentiment and Voice of
Customer Analytics" (HRAST dataset): text preprocessing -> TF-IDF ->
One-vs-Rest Logistic Regression (multi-label aspects, threshold 0.50) ->
Logistic Regression vs Linear SVM (3-class sentiment) -> Pearson/phi
correlation, aspect frequency and aspect-wise negative sentiment rate.
"""
